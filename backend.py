from flask import Flask, request, send_file, jsonify, render_template
import trimesh
import numpy as np
import io
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
CARD_WIDTH = 88.9  # mm (3.5 inches)
CARD_HEIGHT = 50.8  # mm (2 inches)
CARD_THICKNESS = 2.0  # mm
LEFT_MARGIN = 2.0  # mm from left edge
TOP_MARGIN = 2.0   # mm from top edge

CHARS_PER_LINE = 12
MAX_LINES = 4
LINE_SPACING = 2.0  # mm between lines
# Braille dot positions for a single cell (2x3 grid)
DOT_RADIUS = 1.7  # Updated to 1.7mm radius
DOT_HEIGHT = 4.0
# Calculate optimal spacing to fit 12 chars and 4 lines
AVAILABLE_WIDTH = CARD_WIDTH - (2 * LEFT_MARGIN)  # Account for left and right margins
AVAILABLE_HEIGHT = CARD_HEIGHT - (2 * TOP_MARGIN)  # Account for top and bottom margins
DOT_SPACING = AVAILABLE_WIDTH / (12 * 2)  # 12 chars * 2 dots per cell width
CELL_WIDTH = DOT_SPACING * 2
CELL_HEIGHT = (AVAILABLE_HEIGHT - (3 * LINE_SPACING)) / 4  # 4 lines with spacing between them
BASE_THICKNESS = 1.5

# Translation is handled exclusively by liblouis on the frontend.
# Backend only accepts braille Unicode characters (U+2800–U+28FF).

# Dot positions in a cell (x, y)
DOT_POSITIONS = [
    (0, 0), (0, 1), (0, 2),
    (1, 0), (1, 1), (1, 2)
]

def braille_unicode_to_dots(ch: str):
    """Convert a braille Unicode character (U+2800–U+28FF) to a 6-dot pattern list."""
    if not ch:
        return [0, 0, 0, 0, 0, 0]
    code = ord(ch)
    if code < 0x2800 or code > 0x28FF:
        # Non-braille -> treat as blank cell
        return [0, 0, 0, 0, 0, 0]
    bits = code - 0x2800
    return [1 if (bits & (1 << i)) else 0 for i in range(6)]

CARD_WIDTH = 88.9  # mm (3.5 inches)
CARD_HEIGHT = 50.8  # mm (2 inches)
CARD_THICKNESS = 2.0  # mm
LEFT_MARGIN = 2.0  # mm from left edge
TOP_MARGIN = 2.0   # mm from top edge

CHARS_PER_LINE = 12
MAX_LINES = 4
LINE_SPACING = 2.0  # mm between lines

def _validate_braille_lines(lines):
    """Ensure all non-empty characters are braille Unicode."""
    if not isinstance(lines, list):
        raise ValueError('lines must be a list of strings')
    for idx, line in enumerate(lines):
        if not isinstance(line, str):
            raise ValueError(f'Line {idx+1} is not a string')
        for pos, ch in enumerate(line):
            code = ord(ch)
            if ch.strip() and not (0x2800 <= code <= 0x28FF):
                raise ValueError(f"Invalid character at line {idx+1}, pos {pos+1}: U+{code:04X} (not braille)")
    return True

def _normalize_braille_lines(lines):
    """Pad/truncate each line to CHARS_PER_LINE and limit to MAX_LINES."""
    norm = []
    for line in lines[:MAX_LINES]:
        l = line.rstrip('\r\n')
        if len(l) < CHARS_PER_LINE:
            l = l + '\u2800' * (CHARS_PER_LINE - len(l))
        else:
            l = l[:CHARS_PER_LINE]
        norm.append(l)
    while len(norm) < MAX_LINES:
        norm.append('\u2800' * CHARS_PER_LINE)
    return norm

def _build_mesh_from_braille_lines(lines):
    """Create a trimesh mesh from already-translated braille Unicode lines."""
    # Create card base
    base = trimesh.creation.box(extents=(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS))
    base.apply_translation((CARD_WIDTH/2, CARD_HEIGHT/2, CARD_THICKNESS/2))

    meshes = [base]

    # Process each normalized line (exactly MAX_LINES lines, CHARS_PER_LINE chars each)
    for line_num, line in enumerate(lines):
        if line_num >= MAX_LINES:
            break
        y_offset = CARD_HEIGHT - TOP_MARGIN - CELL_HEIGHT - (line_num * (CELL_HEIGHT + LINE_SPACING))
        for i, ch in enumerate(line):
            pattern = braille_unicode_to_dots(ch)
            for j, dot in enumerate(pattern):
                if dot:
                    dx, dy = DOT_POSITIONS[j]
                    flipped_dy = 2 - dy
                    x = LEFT_MARGIN + i * CELL_WIDTH + dx * DOT_SPACING + DOT_SPACING/2
                    y = y_offset + flipped_dy * DOT_SPACING + DOT_SPACING/2
                    z = CARD_THICKNESS + DOT_RADIUS/2
                    sphere = trimesh.creation.uv_sphere(radius=DOT_RADIUS, count=[16, 16])
                    sphere.apply_translation((x, y, z))
                    meshes.append(sphere)

    return trimesh.util.concatenate(meshes)

def create_braille_mesh_from_unicode_lines(lines):
    """Public API to build a mesh from braille Unicode lines."""
    _validate_braille_lines(lines)
    normalized = _normalize_braille_lines(lines)
    return _build_mesh_from_braille_lines(normalized)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_braille_stl', methods=['POST'])
def generate_braille_stl():
    data = request.get_json() or {}
    # Expect braille Unicode lines only. Accept keys 'braille_lines' or 'lines'.
    braille_lines = data.get('braille_lines') or data.get('lines')
    if isinstance(braille_lines, str):
        braille_lines = braille_lines.split('\n')
    if not braille_lines or not isinstance(braille_lines, list):
        return jsonify({'error': 'Provide braille Unicode lines as list under "braille_lines"'}), 400

    # Validate and enforce limits
    try:
        _validate_braille_lines(braille_lines)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    # Limit columns and rows
    too_long = [i+1 for i, l in enumerate(braille_lines) if len(l) > CHARS_PER_LINE]
    if too_long:
        return jsonify({'error': f'One or more lines exceed {CHARS_PER_LINE} braille cells: lines {too_long}'}), 400

    mesh = create_braille_mesh_from_unicode_lines(braille_lines)
    stl_io = io.BytesIO()
    mesh.export(stl_io, file_type='stl')
    stl_io.seek(0)
    # Sanitize filename by removing newlines and other invalid characters
    joined = '\n'.join(braille_lines)
    safe_filename = joined.replace('\n', '_').replace('\r', '_')[:20]
    if not safe_filename.strip():
        safe_filename = 'braille_card'
    return send_file(stl_io, mimetype='model/stl', as_attachment=True, download_name=f'{safe_filename}_braille.stl')

if __name__ == '__main__':
    app.run(debug=True, port=5001) 
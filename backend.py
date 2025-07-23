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
DOT_RADIUS = 1.5
DOT_HEIGHT = 4.0
# Calculate optimal spacing to fit 12 chars and 4 lines
AVAILABLE_WIDTH = CARD_WIDTH - (2 * LEFT_MARGIN)  # Account for left and right margins
AVAILABLE_HEIGHT = CARD_HEIGHT - (2 * TOP_MARGIN)  # Account for top and bottom margins
DOT_SPACING = AVAILABLE_WIDTH / (12 * 2)  # 12 chars * 2 dots per cell width
CELL_WIDTH = DOT_SPACING * 2
CELL_HEIGHT = (AVAILABLE_HEIGHT - (3 * LINE_SPACING)) / 4  # 4 lines with spacing between them
BASE_THICKNESS = 1.5

# Braille alphabet mapping (a-z, space, numbers, symbols)
BRAILLE_MAP = {
    'a': [1, 0, 0, 0, 0, 0],
    'b': [1, 1, 0, 0, 0, 0],
    'c': [1, 0, 0, 1, 0, 0],
    'd': [1, 0, 0, 1, 1, 0],
    'e': [1, 0, 0, 0, 1, 0],
    'f': [1, 1, 0, 1, 0, 0],
    'g': [1, 1, 0, 1, 1, 0],
    'h': [1, 1, 0, 0, 1, 0],
    'i': [0, 1, 0, 1, 0, 0],
    'j': [0, 1, 0, 1, 1, 0],
    'k': [1, 0, 1, 0, 0, 0],
    'l': [1, 1, 1, 0, 0, 0],
    'm': [1, 0, 1, 1, 0, 0],
    'n': [1, 0, 1, 1, 1, 0],
    'o': [1, 0, 1, 0, 1, 0],
    'p': [1, 1, 1, 1, 0, 0],
    'q': [1, 1, 1, 1, 1, 0],
    'r': [1, 1, 1, 0, 1, 0],
    's': [0, 1, 1, 1, 0, 0],
    't': [0, 1, 1, 1, 1, 0],
    'u': [1, 0, 1, 0, 0, 1],
    'v': [1, 1, 1, 0, 0, 1],
    'w': [0, 1, 0, 1, 1, 1],
    'x': [1, 0, 1, 1, 0, 1],
    'y': [1, 0, 1, 1, 1, 1],
    'z': [1, 0, 1, 0, 1, 1],
    ' ': [0, 0, 0, 0, 0, 0],
    # Braille number sign (⠼)
    '#': [0, 0, 1, 1, 1, 1],
    # Numbers (same as a-j)
    '0': [0, 1, 0, 1, 1, 0],  # same as j
    '1': [1, 0, 0, 0, 0, 0],  # same as a
    '2': [1, 1, 0, 0, 0, 0],  # same as b
    '3': [1, 0, 0, 1, 0, 0],  # same as c
    '4': [1, 0, 0, 1, 1, 0],  # same as d
    '5': [1, 0, 0, 0, 1, 0],  # same as e
    '6': [1, 1, 0, 1, 0, 0],  # same as f
    '7': [1, 1, 0, 1, 1, 0],  # same as g
    '8': [1, 1, 0, 0, 1, 0],  # same as h
    '9': [0, 1, 0, 1, 0, 0],  # same as i
    # Common symbols
    '.': [0, 0, 0, 0, 0, 1],
    ',': [0, 0, 0, 0, 1, 0],
    '!': [0, 0, 1, 0, 1, 0],
    '?': [0, 0, 1, 0, 0, 1],
    '-': [0, 0, 0, 0, 1, 1],
    "'": [0, 0, 0, 0, 0, 1],
    '"': [0, 0, 0, 0, 0, 1],
    '(': [0, 0, 1, 1, 1, 0],
    ')': [0, 0, 1, 1, 1, 0],
    '/': [0, 0, 0, 1, 0, 1],
    '\\': [0, 0, 0, 1, 0, 1],
    '@': [0, 0, 0, 0, 0, 1],
    '$': [0, 0, 0, 0, 0, 1],
    '%': [0, 0, 0, 0, 0, 1],
    '^': [0, 0, 0, 0, 0, 1],
    '&': [0, 0, 0, 0, 0, 1],
    '*': [0, 0, 0, 0, 0, 1],
    '+': [0, 0, 0, 0, 0, 1],
    '=': [0, 0, 0, 0, 0, 1],
    '<': [0, 0, 0, 0, 0, 1],
    '>': [0, 0, 0, 0, 0, 1],
    '[': [0, 0, 1, 1, 1, 0],
    ']': [0, 0, 1, 1, 1, 0],
    '{': [0, 0, 1, 1, 1, 0],
    '}': [0, 0, 1, 1, 1, 0],
    '|': [0, 0, 0, 1, 0, 1],
    '~': [0, 0, 0, 0, 0, 1],
    '`': [0, 0, 0, 0, 0, 1],
    '_': [0, 0, 0, 0, 1, 1],
}

# Dot positions in a cell (x, y)
DOT_POSITIONS = [
    (0, 0), (0, 1), (0, 2),
    (1, 0), (1, 1), (1, 2)
]

CARD_WIDTH = 88.9  # mm (3.5 inches)
CARD_HEIGHT = 50.8  # mm (2 inches)
CARD_THICKNESS = 2.0  # mm
LEFT_MARGIN = 2.0  # mm from left edge
TOP_MARGIN = 2.0   # mm from top edge

CHARS_PER_LINE = 12
MAX_LINES = 4
LINE_SPACING = 2.0  # mm between lines

NUMBER_SIGN = [0, 0, 1, 1, 1, 1]  # Braille number sign pattern (dots 3-4-5-6)

def add_number_signs(text):
    """Add Braille number signs before consecutive digits"""
    import re
    result = []
    i = 0
    while i < len(text):
        if text[i].isdigit():
            # Check if this is the start of a number sequence
            if i == 0 or not text[i-1].isdigit():
                result.append('#')  # Add number sign
            result.append(text[i])
        else:
            result.append(text[i])
        i += 1
    return ''.join(result)

def wrap_text(text, max_chars_per_line):
    """Wrap text to fit within max_chars_per_line, breaking at word boundaries when possible"""
    lines = []
    current_line = ""
    
    # Split by newlines first, then process each line
    paragraphs = text.split('\n')
    
    for paragraph in paragraphs:
        words = paragraph.split()
        for word in words:
            # If adding this word would exceed the limit
            if len(current_line) + len(word) + 1 > max_chars_per_line:
                if current_line:  # If we have content, start a new line
                    lines.append(current_line.strip())
                    current_line = word
                else:  # If current line is empty, force break the word
                    lines.append(word[:max_chars_per_line])
                    current_line = word[max_chars_per_line:]
            else:
                if current_line:
                    current_line += " " + word
                else:
                    current_line = word
        
        # Add the last line of this paragraph
        if current_line:
            lines.append(current_line.strip())
            current_line = ""
    
    # Add any remaining content
    if current_line:
        lines.append(current_line.strip())
    
    return lines

def create_braille_mesh(word):
    word = word.lower()
    # Wrap text to fit 12 characters per line, up to 4 lines
    wrapped_lines = wrap_text(word, CHARS_PER_LINE)[:MAX_LINES]
    
    # Process each line to add number signs
    processed_lines = []
    for line in wrapped_lines:
        line = line.rstrip('\r\n')  # Remove trailing newlines
        if not line.strip():
            # If the line is empty or only spaces, fill with spaces
            processed_lines.append(' ' * CHARS_PER_LINE)
        else:
            processed_line = add_number_signs(line)
            processed_lines.append(processed_line)
    
    meshes = []
    # Create card base
    base = trimesh.creation.box(extents=(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS))
    base.apply_translation((CARD_WIDTH/2, CARD_HEIGHT/2, CARD_THICKNESS/2))
    meshes.append(base)
    
    # Process each line (up to 4 lines)
    for line_num, line in enumerate(processed_lines):
        if line_num >= MAX_LINES:
            break
        # Truncate line to 12 characters if needed
        line = line[:CHARS_PER_LINE]
        y_offset = CARD_HEIGHT - TOP_MARGIN - CELL_HEIGHT - (line_num * (CELL_HEIGHT + LINE_SPACING))
        for i, char in enumerate(line):
            pattern = BRAILLE_MAP.get(char, BRAILLE_MAP[' '])  # Default to blank cell
            for j, dot in enumerate(pattern):
                if dot:
                    dx, dy = DOT_POSITIONS[j]
                    # Flip y so 0 is at the top
                    flipped_dy = 2 - dy
                    x = LEFT_MARGIN + i * CELL_WIDTH + dx * DOT_SPACING + DOT_SPACING/2
                    y = y_offset + flipped_dy * DOT_SPACING + DOT_SPACING/2
                    z = CARD_THICKNESS + DOT_RADIUS/2
                    sphere = trimesh.creation.uv_sphere(radius=DOT_RADIUS, count=[16, 16])
                    sphere.apply_translation((x, y, z))
                    meshes.append(sphere)
    return trimesh.util.concatenate(meshes)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_braille_stl', methods=['POST'])
def generate_braille_stl():
    data = request.get_json()
    word = data.get('word', '')
    if not word:
        return jsonify({'error': 'Invalid input'}), 400
    # Wrap text and check length
    wrapped_lines = wrap_text(word.lower(), CHARS_PER_LINE)
    flattened = ''.join(wrapped_lines)
    if len(flattened) > CHARS_PER_LINE * MAX_LINES:
        over = len(flattened) - (CHARS_PER_LINE * MAX_LINES)
        return jsonify({'error': f'Input too long: max {CHARS_PER_LINE * MAX_LINES} Braille characters (12 per line, 4 lines). Your input is {over} character(s) too long after wrapping.'}), 400
    if len(wrapped_lines) > MAX_LINES:
        return jsonify({'error': f'Input too long: max {MAX_LINES} lines of 12 Braille characters.'}), 400
    mesh = create_braille_mesh(word)
    stl_io = io.BytesIO()
    mesh.export(stl_io, file_type='stl')
    stl_io.seek(0)
    # Sanitize filename by removing newlines and other invalid characters
    safe_filename = word.replace('\n', '_').replace('\r', '_')[:20]
    if not safe_filename.strip():
        safe_filename = 'braille_card'
    return send_file(stl_io, mimetype='model/stl', as_attachment=True, download_name=f'{safe_filename}_braille.stl')

if __name__ == '__main__':
    app.run(debug=True, port=5001) 
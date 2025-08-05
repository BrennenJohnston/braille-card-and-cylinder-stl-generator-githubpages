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

# Unified English Braille (UEB) Grade 1 mapping
BRAILLE_MAP = {
    # Letters
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
    # UEB capital sign (⠠, dots-6)
    '^': [0, 0, 0, 0, 0, 1],
    # UEB number sign (⠼, dots-3-4-5-6)
    '#': [0, 0, 1, 1, 1, 1],
    # Numbers (a-j after number sign)
    '1': [1, 0, 0, 0, 0, 0],  # a
    '2': [1, 1, 0, 0, 0, 0],  # b
    '3': [1, 0, 0, 1, 0, 0],  # c
    '4': [1, 0, 0, 1, 1, 0],  # d
    '5': [1, 0, 0, 0, 1, 0],  # e
    '6': [1, 1, 0, 1, 0, 0],  # f
    '7': [1, 1, 0, 1, 1, 0],  # g
    '8': [1, 1, 0, 0, 1, 0],  # h
    '9': [0, 1, 0, 1, 0, 0],  # i
    '0': [0, 1, 0, 1, 1, 0],  # j
    # UEB punctuation
    '.': [0, 0, 1, 1, 0, 1],      # period (dots 3-4-6)
    ',': [0, 1, 0, 0, 0, 0],      # comma (dot 2)
    ';': [0, 1, 1, 0, 0, 0],      # semicolon (dots 2-3)
    ':': [0, 1, 0, 0, 1, 0],      # colon (dots 2-5)
    '?': [0, 1, 0, 0, 0, 1],      # question (dots 2-6)
    '!': [0, 1, 1, 0, 1, 0],      # exclamation (dots 2-3-5)
    '(': [0, 1, 1, 0, 0, 1],      # open paren (dots 2-3-6)
    ')': [0, 1, 1, 0, 0, 1],      # close paren (dots 2-3-6)
    '"': [0, 1, 0, 0, 0, 1],     # quotation (dots 2-6)
    '-': [0, 0, 1, 0, 0, 1],      # hyphen (dots 3-6)
    '/': [0, 0, 1, 0, 1, 0],      # slash (dots 3-5)
    '\\': [0, 0, 1, 0, 1, 0],    # backslash (dots 3-5)
    '@': [0, 1, 1, 1, 0, 0],      # at (dots 2-3-4)
    # Add more as needed
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

def text_to_ueb_braille(text):
    """
    Convert text to UEB Grade 1 braille cell sequence (as a list of chars for mapping),
    inserting capital and number signs as needed.
    """
    result = []
    i = 0
    while i < len(text):
        c = text[i]
        if c.isupper():
            result.append('^')  # Capital sign
            result.append(c.lower())
        elif c.isdigit():
            # Insert number sign if not already in number mode
            if i == 0 or not text[i-1].isdigit():
                result.append('#')
            result.append(c)
        else:
            result.append(c)
        i += 1
    return result

def create_braille_mesh(word):
    # Wrap text to fit 12 characters per line, up to 4 lines
    wrapped_lines = wrap_text(word, CHARS_PER_LINE)[:MAX_LINES]

    # Process each line to UEB braille
    processed_lines = []
    for line in wrapped_lines:
        line = line.rstrip('\r\n')  # Remove trailing newlines
        if not line.strip():
            processed_lines.append([' '] * CHARS_PER_LINE)
        else:
            braille_cells = text_to_ueb_braille(line)
            # Pad or truncate to CHARS_PER_LINE
            if len(braille_cells) < CHARS_PER_LINE:
                braille_cells += [' '] * (CHARS_PER_LINE - len(braille_cells))
            processed_lines.append(braille_cells[:CHARS_PER_LINE])

    # For now, let's create positive braille since boolean operations aren't working
    # This will give you a working STL with 1.7mm radius dots
    print("Creating positive braille (raised dots) with 1.7mm radius")
    
    # Create card base
    base = trimesh.creation.box(extents=(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS))
    base.apply_translation((CARD_WIDTH/2, CARD_HEIGHT/2, CARD_THICKNESS/2))
    
    meshes = [base]
    
    # Process each line (up to 4 lines)
    for line_num, line in enumerate(processed_lines):
        if line_num >= MAX_LINES:
            break
        y_offset = CARD_HEIGHT - TOP_MARGIN - CELL_HEIGHT - (line_num * (CELL_HEIGHT + LINE_SPACING))
        for i, char in enumerate(line):
            pattern = BRAILLE_MAP.get(char, BRAILLE_MAP[' '])  # Default to blank cell
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
    
    print(f"Created positive braille with {len(meshes)-1} dots")
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
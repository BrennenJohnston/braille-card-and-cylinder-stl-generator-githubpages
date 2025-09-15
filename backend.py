from flask import Flask, request, send_file, jsonify, render_template
import trimesh
import numpy as np
import io
from flask_cors import CORS
try:
    # Used for recessed indicator markers (triangle/line) extrusion
    from shapely.geometry import Polygon  # type: ignore
except Exception:
    Polygon = None  # Fallback if shapely not available; markers will be skipped

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


# ---------------------------
# Indicator marker primitives
# ---------------------------
def _create_triangle_marker_prism(x_center: float, y_center: float, height: float = 0.6, for_subtraction: bool = True) -> trimesh.Trimesh | None:
    """Create a triangular prism used as a recessed indicator (apex pointing right).

    This matches the working upstream implementation:
    - Base vertical span: 2 * DOT_SPACING (distance between top and bottom dots)
    - Horizontal reach: DOT_SPACING (extends to middle-right dot position)
    - Base positioned at left column, apex pointing toward right column
    """
    if Polygon is None:
        return None

    # Triangle dimensions (match upstream exactly)
    base_height = 2 * DOT_SPACING  # Vertical extent
    triangle_width = DOT_SPACING   # Horizontal extent

    # Triangle vertices: base on left, apex pointing right
    # Base is centered between top and bottom dots
    base_x = x_center - DOT_SPACING / 2.0  # Left column position
    
    vertices = [
        (base_x, y_center - DOT_SPACING),      # Bottom of base
        (base_x, y_center + DOT_SPACING),      # Top of base  
        (base_x + triangle_width, y_center)    # Apex (at middle-right dot height)
    ]

    # Create 2D polygon using Shapely
    tri_2d = Polygon(vertices)
    
    if for_subtraction:
        # For counter plate recesses, extrude downward from top surface
        extrude_height = height + 0.5  # Extra depth to ensure clean boolean
        tri_prism = trimesh.creation.extrude_polygon(tri_2d, height=extrude_height)
        
        # Position at the top surface of the card
        z_pos = CARD_THICKNESS - 0.1  # Start slightly above surface
        tri_prism.apply_translation([0.0, 0.0, z_pos])
    else:
        # For embossing plate, extrude upward from top surface
        tri_prism = trimesh.creation.extrude_polygon(tri_2d, height=height)
        
        # Position on top of the card base
        z_pos = CARD_THICKNESS
        tri_prism.apply_translation([0.0, 0.0, z_pos])
    
    return tri_prism


def _create_line_end_marker_prism(x_center: float, y_center: float, height: float = 0.5, for_subtraction: bool = True) -> trimesh.Trimesh | None:
    """Create a rectangular prism used as a recessed line-end indicator.

    This matches the working upstream implementation:
    - Vertical span: 2 * DOT_SPACING (distance between top and bottom dots)
    - Horizontal width: DOT_SPACING centered on the cell
    - Positioned at the start of each row for line-end marking
    """
    if Polygon is None:
        return None

    # Line dimensions (match upstream exactly)
    line_height = 2 * DOT_SPACING  # Vertical extent
    line_width = DOT_SPACING       # Horizontal width

    # Rectangle vertices: centered on the cell
    vertices = [
        (x_center - line_width/2.0, y_center - DOT_SPACING),  # Bottom left
        (x_center + line_width/2.0, y_center - DOT_SPACING),  # Bottom right
        (x_center + line_width/2.0, y_center + DOT_SPACING),  # Top right
        (x_center - line_width/2.0, y_center + DOT_SPACING),  # Top left
    ]

    # Create 2D polygon using Shapely
    rect_2d = Polygon(vertices)
    
    if for_subtraction:
        # For counter plate recesses, extrude downward from top surface
        extrude_height = height + 0.5  # Extra depth to ensure clean boolean
        rect_prism = trimesh.creation.extrude_polygon(rect_2d, height=extrude_height)
        
        # Position at the top surface of the card
        z_pos = CARD_THICKNESS - 0.1  # Start slightly above surface
        rect_prism.apply_translation([0.0, 0.0, z_pos])
    else:
        # For embossing plate, extrude upward from top surface
        rect_prism = trimesh.creation.extrude_polygon(rect_2d, height=height)
        
        # Position on top of the card base
        z_pos = CARD_THICKNESS
        rect_prism.apply_translation([0.0, 0.0, z_pos])
    
    return rect_prism


def _create_hemisphere_sphere(dot_x: float, dot_y: float, radius: float) -> trimesh.Trimesh:
    """Create an icosphere positioned so its equator lies at the top surface for subtraction."""
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=radius)
    sphere.apply_translation((dot_x, dot_y, CARD_THICKNESS))
    return sphere


def build_counter_plate_with_hemispheres() -> trimesh.Trimesh:
    """Create a counter plate with hemispherical recesses and recessed indicator markers.

    This implementation follows the working upstream approach:
    - Create simple icospheres (hemispheres) for all dot positions
    - Use proper grid layout with reserved columns for indicators
    - Position hemispheres with equator at surface level
    - Create recessed triangle and line markers using proper orientation
    """
    # Base plate
    plate = trimesh.creation.box(extents=(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS))
    plate.apply_translation((CARD_WIDTH/2.0, CARD_HEIGHT/2.0, CARD_THICKNESS/2.0))

    # Grid dimensions - reserve first and last columns for indicators
    grid_columns_total = CHARS_PER_LINE + 2  # reserve first/last for indicators
    grid_rows = MAX_LINES

    # Dot positioning constants (match upstream)
    dot_col_offsets = [-DOT_SPACING / 2.0, DOT_SPACING / 2.0]
    dot_row_offsets = [DOT_SPACING, 0.0, -DOT_SPACING]
    dot_positions = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)]

    # Hemisphere radius - use dot spacing/2 for proper recess size
    hemisphere_radius = DOT_SPACING / 2.0

    # Create icospheres (hemispheres) for all dot positions
    sphere_meshes = []
    for row_idx in range(grid_rows):
        # Calculate Y position for this row (match upstream positioning)
        y_pos = CARD_HEIGHT - TOP_MARGIN - (row_idx * (CELL_HEIGHT + LINE_SPACING))

        # Process text columns (skip first and last indicator columns)
        for col_idx in range(1, grid_columns_total - 1):
            # Calculate X position for this column
            x_pos = LEFT_MARGIN + col_idx * CELL_WIDTH + DOT_SPACING

            # Create hemispheres for all 6 dots in this cell
            for dot_idx in range(6):
                dot_pos = dot_positions[dot_idx]
                dot_x = x_pos + dot_col_offsets[dot_pos[1]]
                dot_y = y_pos + dot_row_offsets[dot_pos[0]]

                # Create icosphere with proper radius
                sphere = trimesh.creation.icosphere(subdivisions=2, radius=hemisphere_radius)
                # Position so equator lies at top surface (z = CARD_THICKNESS)
                sphere.apply_translation((dot_x, dot_y, CARD_THICKNESS))
                sphere_meshes.append(sphere)

    # Create recessed indicator markers for all rows
    line_markers = []
    triangle_markers = []
    for row_idx in range(grid_rows):
        y_pos = CARD_HEIGHT - TOP_MARGIN - (row_idx * (CELL_HEIGHT + LINE_SPACING))

        # Line marker at first column (left side)
        x_first = LEFT_MARGIN + DOT_SPACING
        line_mesh = _create_line_end_marker_prism(x_first, y_pos, height=0.5, for_subtraction=True)
        if line_mesh is not None:
            line_markers.append(line_mesh)

        # Triangle marker at last column (right side)
        x_last = LEFT_MARGIN + (grid_columns_total - 1) * CELL_WIDTH + DOT_SPACING
        tri_mesh = _create_triangle_marker_prism(x_last, y_pos, height=0.5, for_subtraction=True)
        if tri_mesh is not None:
            triangle_markers.append(tri_mesh)

    # Perform boolean operations - try multiple engines for robustness
    engines_to_try = [None]  # Use trimesh default engine
    
    for engine in engines_to_try:
        try:
            # Union all spheres for efficient subtraction
            if len(sphere_meshes) == 0:
                union_spheres = None
            elif len(sphere_meshes) == 1:
                union_spheres = sphere_meshes[0]
            else:
                union_spheres = trimesh.boolean.union(sphere_meshes, engine=engine)

            # Union all markers
            union_lines = None
            if line_markers:
                union_lines = line_markers[0] if len(line_markers) == 1 else trimesh.boolean.union(line_markers, engine=engine)
            
            union_tris = None
            if triangle_markers:
                union_tris = triangle_markers[0] if len(triangle_markers) == 1 else trimesh.boolean.union(triangle_markers, engine=engine)

            # Combine all cutouts for subtraction
            cutouts = []
            if union_spheres is not None:
                cutouts.append(union_spheres)
            if union_lines is not None:
                cutouts.append(union_lines)
            if union_tris is not None:
                cutouts.append(union_tris)

            if cutouts:
                all_cutouts = cutouts[0] if len(cutouts) == 1 else trimesh.boolean.union(cutouts, engine=engine)
                result = trimesh.boolean.difference(plate, all_cutouts, engine=engine)
                if isinstance(result, trimesh.Trimesh):
                    return result
            
            # If we reach here, the engine worked but no cutouts were processed
            return plate
            
        except Exception as e:
            print(f"Boolean operation failed with engine {engine}: {e}")
            continue
    
    # If all engines failed, return base plate
    print("Warning: All boolean engines failed, returning base plate")
    return plate

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


@app.route('/generate_counter_plate_stl', methods=['POST'])
def generate_counter_plate_stl():
    """Generate a universal counter plate STL with recessed indicator markers.

    Orientation logic mirrors the upstream working repo:
    - Line marker recessed at first column of each row
    - Triangle marker recessed at last column of each row (apex toward right)
    - Hemispherical recesses for all six dots in every text cell
    """
    # Optional: accept no body or ignore content; this plate is text-agnostic
    try:
        mesh = build_counter_plate_with_hemispheres()
        stl_io = io.BytesIO()
        mesh.export(stl_io, file_type='stl')
        stl_io.seek(0)
        return send_file(stl_io, mimetype='model/stl', as_attachment=True, download_name='counter_plate.stl')
    except Exception as e:
        return jsonify({'error': f'Failed to generate counter plate: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001) 
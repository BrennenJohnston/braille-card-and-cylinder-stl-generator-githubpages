warning: in the working copy of 'backend.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'templates/index.html', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/backend.py b/backend.py[m
[1mindex bde18df..193cdd4 100644[m
[1m--- a/backend.py[m
[1m+++ b/backend.py[m
[36m@@ -2,232 +2,367 @@[m [mfrom flask import Flask, request, send_file, jsonify, render_template[m
 import trimesh[m
 import numpy as np[m
 import io[m
[32m+[m[32mimport os[m
[32m+[m[32mimport subprocess[m
[32m+[m[32mimport re[m
[32m+[m[32mimport platform[m
[32m+[m[32mfrom pathlib import Path[m
 from flask_cors import CORS[m
 [m
 app = Flask(__name__)[m
 CORS(app)[m
[31m-CARD_WIDTH = 88.9  # mm (3.5 inches)[m
[31m-CARD_HEIGHT = 50.8  # mm (2 inches)[m
[31m-CARD_THICKNESS = 2.0  # mm[m
[31m-LEFT_MARGIN = 2.0  # mm from left edge[m
[31m-TOP_MARGIN = 2.0   # mm from top edge[m
[31m-[m
[31m-CHARS_PER_LINE = 12[m
[31m-MAX_LINES = 4[m
[31m-LINE_SPACING = 2.0  # mm between lines[m
[31m-# Braille dot positions for a single cell (2x3 grid)[m
[31m-DOT_RADIUS = 1.7  # Updated to 1.7mm radius[m
[31m-DOT_HEIGHT = 4.0[m
[31m-# Calculate optimal spacing to fit 12 chars and 4 lines[m
[31m-AVAILABLE_WIDTH = CARD_WIDTH - (2 * LEFT_MARGIN)  # Account for left and right margins[m
[31m-AVAILABLE_HEIGHT = CARD_HEIGHT - (2 * TOP_MARGIN)  # Account for top and bottom margins[m
[31m-DOT_SPACING = AVAILABLE_WIDTH / (12 * 2)  # 12 chars * 2 dots per cell width[m
[31m-CELL_WIDTH = DOT_SPACING * 2[m
[31m-CELL_HEIGHT = (AVAILABLE_HEIGHT - (3 * LINE_SPACING)) / 4  # 4 lines with spacing between them[m
[31m-BASE_THICKNESS = 1.5[m
[31m-[m
[31m-# Unified English Braille (UEB) Grade 1 mapping[m
[31m-BRAILLE_MAP = {[m
[31m-    # Letters[m
[31m-    'a': [1, 0, 0, 0, 0, 0],[m
[31m-    'b': [1, 1, 0, 0, 0, 0],[m
[31m-    'c': [1, 0, 0, 1, 0, 0],[m
[31m-    'd': [1, 0, 0, 1, 1, 0],[m
[31m-    'e': [1, 0, 0, 0, 1, 0],[m
[31m-    'f': [1, 1, 0, 1, 0, 0],[m
[31m-    'g': [1, 1, 0, 1, 1, 0],[m
[31m-    'h': [1, 1, 0, 0, 1, 0],[m
[31m-    'i': [0, 1, 0, 1, 0, 0],[m
[31m-    'j': [0, 1, 0, 1, 1, 0],[m
[31m-    'k': [1, 0, 1, 0, 0, 0],[m
[31m-    'l': [1, 1, 1, 0, 0, 0],[m
[31m-    'm': [1, 0, 1, 1, 0, 0],[m
[31m-    'n': [1, 0, 1, 1, 1, 0],[m
[31m-    'o': [1, 0, 1, 0, 1, 0],[m
[31m-    'p': [1, 1, 1, 1, 0, 0],[m
[31m-    'q': [1, 1, 1, 1, 1, 0],[m
[31m-    'r': [1, 1, 1, 0, 1, 0],[m
[31m-    's': [0, 1, 1, 1, 0, 0],[m
[31m-    't': [0, 1, 1, 1, 1, 0],[m
[31m-    'u': [1, 0, 1, 0, 0, 1],[m
[31m-    'v': [1, 1, 1, 0, 0, 1],[m
[31m-    'w': [0, 1, 0, 1, 1, 1],[m
[31m-    'x': [1, 0, 1, 1, 0, 1],[m
[31m-    'y': [1, 0, 1, 1, 1, 1],[m
[31m-    'z': [1, 0, 1, 0, 1, 1],[m
[31m-    ' ': [0, 0, 0, 0, 0, 0],[m
[31m-    # UEB capital sign (⠠, dots-6)[m
[31m-    '^': [0, 0, 0, 0, 0, 1],[m
[31m-    # UEB number sign (⠼, dots-3-4-5-6)[m
[31m-    '#': [0, 0, 1, 1, 1, 1],[m
[31m-    # Numbers (a-j after number sign)[m
[31m-    '1': [1, 0, 0, 0, 0, 0],  # a[m
[31m-    '2': [1, 1, 0, 0, 0, 0],  # b[m
[31m-    '3': [1, 0, 0, 1, 0, 0],  # c[m
[31m-    '4': [1, 0, 0, 1, 1, 0],  # d[m
[31m-    '5': [1, 0, 0, 0, 1, 0],  # e[m
[31m-    '6': [1, 1, 0, 1, 0, 0],  # f[m
[31m-    '7': [1, 1, 0, 1, 1, 0],  # g[m
[31m-    '8': [1, 1, 0, 0, 1, 0],  # h[m
[31m-    '9': [0, 1, 0, 1, 0, 0],  # i[m
[31m-    '0': [0, 1, 0, 1, 1, 0],  # j[m
[31m-    # UEB punctuation[m
[31m-    '.': [0, 0, 1, 1, 0, 1],      # period (dots 3-4-6)[m
[31m-    ',': [0, 1, 0, 0, 0, 0],      # comma (dot 2)[m
[31m-    ';': [0, 1, 1, 0, 0, 0],      # semicolon (dots 2-3)[m
[31m-    ':': [0, 1, 0, 0, 1, 0],      # colon (dots 2-5)[m
[31m-    '?': [0, 1, 0, 0, 0, 1],      # question (dots 2-6)[m
[31m-    '!': [0, 1, 1, 0, 1, 0],      # exclamation (dots 2-3-5)[m
[31m-    '(': [0, 1, 1, 0, 0, 1],      # open paren (dots 2-3-6)[m
[31m-    ')': [0, 1, 1, 0, 0, 1],      # close paren (dots 2-3-6)[m
[31m-    '"': [0, 1, 0, 0, 0, 1],     # quotation (dots 2-6)[m
[31m-    '-': [0, 0, 1, 0, 0, 1],      # hyphen (dots 3-6)[m
[31m-    '/': [0, 0, 1, 0, 1, 0],      # slash (dots 3-5)[m
[31m-    '\\': [0, 0, 1, 0, 1, 0],    # backslash (dots 3-5)[m
[31m-    '@': [0, 1, 1, 1, 0, 0],      # at (dots 2-3-4)[m
[31m-    # Add more as needed[m
[31m-}[m
[31m-[m
[31m-# Dot positions in a cell (x, y)[m
[31m-DOT_POSITIONS = [[m
[31m-    (0, 0), (0, 1), (0, 2),[m
[31m-    (1, 0), (1, 1), (1, 2)[m
[31m-][m
[31m-[m
[31m-CARD_WIDTH = 88.9  # mm (3.5 inches)[m
[31m-CARD_HEIGHT = 50.8  # mm (2 inches)[m
[31m-CARD_THICKNESS = 2.0  # mm[m
[31m-LEFT_MARGIN = 2.0  # mm from left edge[m
[31m-TOP_MARGIN = 2.0   # mm from top edge[m
[31m-[m
[31m-CHARS_PER_LINE = 12[m
[31m-MAX_LINES = 4[m
[31m-LINE_SPACING = 2.0  # mm between lines[m
[31m-[m
[31m-NUMBER_SIGN = [0, 0, 1, 1, 1, 1]  # Braille number sign pattern (dots 3-4-5-6)[m
[31m-[m
[31m-def add_number_signs(text):[m
[31m-    """Add Braille number signs before consecutive digits"""[m
[31m-    import re[m
[31m-    result = [][m
[31m-    i = 0[m
[31m-    while i < len(text):[m
[31m-        if text[i].isdigit():[m
[31m-            # Check if this is the start of a number sequence[m
[31m-            if i == 0 or not text[i-1].isdigit():[m
[31m-                result.append('#')  # Add number sign[m
[31m-            result.append(text[i])[m
[31m-        else:[m
[31m-            result.append(text[i])[m
[31m-        i += 1[m
[31m-    return ''.join(result)[m
[31m-[m
[31m-def wrap_text(text, max_chars_per_line):[m
[31m-    """Wrap text to fit within max_chars_per_line, breaking at word boundaries when possible"""[m
[31m-    lines = [][m
[31m-    current_line = ""[m
[32m+[m
[32m+[m[32mclass CardSettings:[m
[32m+[m[32m    def __init__(self, **kwargs):[m
[32m+[m[32m        # Default values from OpenSCAD script[m
[32m+[m[32m        defaults = {[m
[32m+[m[32m            "card_width": 90,[m
[32m+[m[32m            "card_height": 52,[m
[32m+[m[32m            "card_thickness": 2.0,[m
[32m+[m[32m            "grid_columns": 13,[m
[32m+[m[32m            "grid_rows": 4,[m
[32m+[m[32m            "cell_spacing": 7.0,[m
[32m+[m[32m            "line_spacing": 12.0,[m
[32m+[m[32m            "dot_spacing": 2.5,[m
[32m+[m[32m            "dot_base_diameter": 2.0,[m
[32m+[m[32m            "dot_hat_size": 0.8,[m
[32m+[m[32m            "dot_height": 1.4,[m
[32m+[m[32m            "braille_y_adjust": 0.4,[m
[32m+[m[32m            "braille_x_adjust": 0.1,[m
[32m+[m[32m            "negative_plate_offset": 0.4,[m
[32m+[m[32m        }[m
[32m+[m[41m        [m
[32m+[m[32m        # Set attributes from kwargs or defaults[m
[32m+[m[32m        for key, value in defaults.items():[m
[32m+[m[32m            setattr(self, key, float(kwargs.get(key, value)))[m
[32m+[m[41m        [m
[32m+[m[32m        # Calculated properties[m
[32m+[m[32m        self.dot_top_diameter = self.dot_hat_size[m
[32m+[m[32m        self.grid_width = (self.grid_columns - 1) * self.cell_spacing[m
[32m+[m[32m        self.left_margin = (self.card_width - self.grid_width) / 2[m
[32m+[m[32m        self.grid_height = (self.grid_rows - 1) * self.line_spacing[m
[32m+[m[32m        self.top_margin = (self.card_height - self.grid_height) / 2[m
[32m+[m[41m        [m
[32m+[m[32m        # Recessed dot parameters (adjusted by offset)[m
[32m+[m[32m        self.recessed_dot_base_diameter = self.dot_base_diameter + (self.negative_plate_offset * 2)[m
[32m+[m[32m        self.recessed_dot_top_diameter = self.dot_hat_size + (self.negative_plate_offset * 2)[m
[32m+[m[32m        self.recessed_dot_height = self.dot_height + self.negative_plate_offset[m
[32m+[m
[32m+[m[32m# Liblouis integration[m
[32m+[m[32mLIB = Path(__file__).parent / "third_party" / "liblouis"[m
[32m+[m
[32m+[m[32m# Cross-platform executable name[m
[32m+[m[32mif platform.system() == "Window
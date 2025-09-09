// Geometry builders for client-side STL generation
// Uses three.js primitives to construct positive embossing plates for card and cylinder

import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

function getAvailableColumns(settings) {
    const gridColumns = Number(settings.grid_columns || settings.gridColumns || 26);
    return Math.max(0, gridColumns - 2);
}

function getGridRows(settings) {
    return Number(settings.grid_rows || settings.gridRows || 4);
}

function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function brailleUnicodeToDots(ch) {
    // Braille patterns: U+2800 base, bits 0..5 correspond to dots 1..6
    const code = ch.codePointAt(0) || 0;
    const pattern = code - 0x2800;
    const dots = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
        dots[i] = (pattern & (1 << i)) ? 1 : 0;
    }
    return dots; // order: [1,2,3,4,5,6]
}

function createDotGeometry(settings) {
    // New cylinder + dome shape parameters
    const cylinderDiameter = toNumber(settings.emboss_dot_cylinder_diameter || settings.emboss_dot_base_diameter, 1.5);
    const cylinderHeight = toNumber(settings.emboss_dot_cylinder_height || settings.emboss_dot_height, 0.1);
    const domeHeight = toNumber(settings.emboss_dot_dome_height || 0.5, 0.5);
    const radialSegments = 16;
    
    // Create cylinder base
    const cylinderRadius = Math.max(0, cylinderDiameter / 2);
    const cylinderGeom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, radialSegments, 1, false);
    cylinderGeom.rotateX(Math.PI / 2);
    
    // Create dome on top
    // Use a sphere and clip it to create a dome
    const sphereRadius = cylinderRadius; // Dome base matches cylinder diameter
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, radialSegments, radialSegments);
    
    // Create clipping planes to cut the sphere in half
    const positions = sphereGeom.attributes.position;
    const newPositions = [];
    const newIndices = [];
    const vertices = [];
    
    // Collect vertices that are above z=0 (top hemisphere)
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        if (z >= 0) {
            // Scale the dome height
            const scaledZ = (z / sphereRadius) * domeHeight;
            vertices.push({ x, y, z: scaledZ, index: i });
            newPositions.push(x, y, scaledZ);
        }
    }
    
    // Create new geometry for the dome
    const domeGeom = new THREE.BufferGeometry();
    domeGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    
    // Rebuild indices for the dome
    const originalIndices = sphereGeom.index.array;
    const vertexMap = new Map();
    vertices.forEach((v, newIndex) => {
        vertexMap.set(v.index, newIndex);
    });
    
    for (let i = 0; i < originalIndices.length; i += 3) {
        const a = originalIndices[i];
        const b = originalIndices[i + 1];
        const c = originalIndices[i + 2];
        
        if (vertexMap.has(a) && vertexMap.has(b) && vertexMap.has(c)) {
            newIndices.push(vertexMap.get(a), vertexMap.get(b), vertexMap.get(c));
        }
    }
    
    domeGeom.setIndex(newIndices);
    domeGeom.computeVertexNormals();
    
    // Translate dome to sit on top of cylinder
    const domePositions = domeGeom.attributes.position.array;
    for (let i = 0; i < domePositions.length; i += 3) {
        domePositions[i + 2] += cylinderHeight;
    }
    domeGeom.attributes.position.needsUpdate = true;
    
    // Merge geometries using Three.js utilities
    const mergedGeom = new THREE.BufferGeometry();
    
    // Get cylinder index data
    const cylinderIndices = cylinderGeom.index ? Array.from(cylinderGeom.index.array) : [];
    if (cylinderIndices.length === 0) {
        // Generate indices for non-indexed geometry
        const positionCount = cylinderGeom.attributes.position.count;
        for (let i = 0; i < positionCount; i += 3) {
            cylinderIndices.push(i, i + 1, i + 2);
        }
    }
    
    // Translate cylinder vertices so base is at z=0
    const cylinderPositions = cylinderGeom.attributes.position.array;
    const translatedCylinderPositions = new Float32Array(cylinderPositions.length);
    for (let i = 0; i < cylinderPositions.length; i += 3) {
        translatedCylinderPositions[i] = cylinderPositions[i];
        translatedCylinderPositions[i + 1] = cylinderPositions[i + 1];
        // Shift cylinder so its base is at z=0 (cylinder extends from 0 to cylinderHeight)
        translatedCylinderPositions[i + 2] = cylinderPositions[i + 2] + cylinderHeight / 2;
    }
    
    // Combine positions
    const totalVertices = cylinderGeom.attributes.position.count + domeGeom.attributes.position.count;
    const mergedPositions = new Float32Array(totalVertices * 3);
    
    // Copy cylinder positions
    mergedPositions.set(translatedCylinderPositions, 0);
    
    // Copy dome positions (already translated)
    mergedPositions.set(domeGeom.attributes.position.array, cylinderGeom.attributes.position.count * 3);
    
    mergedGeom.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
    
    // Combine indices
    const mergedIndices = [];
    
    // Add cylinder indices
    for (let i = 0; i < cylinderIndices.length; i++) {
        mergedIndices.push(cylinderIndices[i]);
    }
    
    // Add dome indices with offset
    const cylinderVertexCount = cylinderGeom.attributes.position.count;
    for (let i = 0; i < newIndices.length; i++) {
        mergedIndices.push(newIndices[i] + cylinderVertexCount);
    }
    
    mergedGeom.setIndex(mergedIndices);
    mergedGeom.computeVertexNormals();
    
    return mergedGeom;
}

function createBasePlateGeometry(settings) {
    const w = toNumber(settings.card_width, 86);
    const h = toNumber(settings.card_height, 54);
    const t = toNumber(settings.card_thickness, 1.6);
    const geom = new THREE.BoxGeometry(w, h, t, 1, 1, 1);
    return geom;
}

export function buildCardEmbossingPlate(translatedLines, settings) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();

    // Base plate
    const baseGeom = createBasePlateGeometry(settings);
    const baseMesh = new THREE.Mesh(baseGeom, material);
    baseMesh.position.set(
        toNumber(settings.card_width, 86) / 2,
        toNumber(settings.card_height, 54) / 2,
        toNumber(settings.card_thickness, 1.6) / 2
    );
    group.add(baseMesh);

    // Dot positioning constants
    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColOffsets = [-dotSpacing / 2, dotSpacing / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const dotIndexToRowCol = [
        [0, 0], [1, 0], [2, 0], // dots 1,2,3 left column
        [0, 1], [1, 1], [2, 1]  // dots 4,5,6 right column
    ];

    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const cylinderHeight = toNumber(settings.emboss_dot_cylinder_height || settings.emboss_dot_height, 0.1);
    const domeHeight = toNumber(settings.emboss_dot_dome_height || 0.5, 0.5);
    const totalDotHeight = cylinderHeight + domeHeight;
    // Position dots so their base sits on the card surface
    const zTop = toNumber(settings.card_thickness, 1.6);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const dotGeom = createDotGeometry(settings);

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const brailleText = (translatedLines[rowIdx] || '').slice(0, availableColumns);
        const yPos = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;

        for (let col = 0; col < brailleText.length; col++) {
            const ch = brailleText[col];
            const dots = brailleUnicodeToDots(ch);
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;

            for (let i = 0; i < 6; i++) {
                if (!dots[i]) continue;
                const [r, c] = dotIndexToRowCol[i];
                const x = xCell + dotColOffsets[c];
                const y = yPos + dotRowOffsets[r];

                const mesh = new THREE.Mesh(dotGeom, material);
                mesh.position.set(x, y, zTop);
                group.add(mesh);
            }
        }
    }

    return group;
}

export function buildCylinderEmbossingPlate(translatedLines, settings, cylinderParams = {}) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);

    const radius = diameter / 2;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;

    // Base cylinder oriented along Z (match backend STL orientation)
    const cylGeometry = new THREE.CylinderGeometry(radius, radius, height, 96, 1, false);
    cylGeometry.rotateX(Math.PI / 2);
    const baseBrush = new Brush(cylGeometry, material);
    baseBrush.updateMatrixWorld(true);

    const subtractBrushes = [];

    // Optional polygonal cutout (12-gon), subtract along cylinder axis (Z), rotated to seam offset
    if (cutoutInscribed > 0) {
        const sides = 12;
        const shape2d = new THREE.Shape();
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const x = Math.cos(angle) * cutoutInscribed;
            const y = Math.sin(angle) * cutoutInscribed;
            if (i === 0) shape2d.moveTo(x, y); else shape2d.lineTo(x, y);
        }
        shape2d.closePath();
        const cutoutGeom = new THREE.ExtrudeGeometry(shape2d, { depth: height + 2, bevelEnabled: false });
        cutoutGeom.translate(0, 0, - (height + 2) / 2);
        cutoutGeom.rotateZ(thetaOffset);
        const cutoutBrush = new Brush(cutoutGeom, material);
        cutoutBrush.updateMatrixWorld(true);
        subtractBrushes.push(cutoutBrush);
    }

    // Recessed indicator shapes per row (rectangle at start-of-row, triangle at end-of-row)
    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const rectWidth = dotSpacing;
    const rectHeight = 2 * dotSpacing;
    const triBaseHeight = 2 * dotSpacing;
    const triWidth = dotSpacing;

    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const leftMargin = toNumber(settings.left_margin, 8);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const zCenterOffset = -height / 2;
    const rowsSpan = (gridRows - 1) * lineSpacing;
    const recessDepth = Math.min(0.8, Math.max(0.2, toNumber(settings.indicator_recess_depth, 0.5)));

    function orientRadial(mesh, theta, zWorld, radialDistance) {
        const rHat = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), rHat);
        mesh.setRotationFromQuaternion(q);
        const xWorld = rHat.x * radialDistance;
        const yWorld = rHat.y * radialDistance;
        mesh.position.set(xWorld, yWorld, zWorld);
        mesh.updateMatrixWorld(true);
    }

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        // Place indicators centered on row line
        const yLocal = (height / 2) + yAdjust + (rowsSpan / 2 - rowIdx * lineSpacing);
        const zLocal = yLocal + zCenterOffset;

        // Start-of-row rectangle
        {
            const shape = createRectangleShape(rectWidth, rectHeight);
            const geom = new THREE.ExtrudeGeometry(shape, { depth: recessDepth, bevelEnabled: false });
            const brush = new Brush(geom, material);
            const xCellStart = leftMargin + xAdjust;
            const rectTheta = ((xCellStart - dotSpacing / 2) / (Math.PI * diameter)) * Math.PI * 2 + thetaOffset;
            // sink into wall
            orientRadial(brush, rectTheta, zLocal, radius - recessDepth);
            subtractBrushes.push(brush);
        }

        // End-of-row triangle (apex points along +theta)
        {
            const triShape = createTriangleShape(triBaseHeight, triWidth);
            const triGeom = new THREE.ExtrudeGeometry(triShape, { depth: recessDepth, bevelEnabled: false });
            const triBrush = new Brush(triGeom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const triTheta = ((xCellEnd - dotSpacing / 2) / (Math.PI * diameter)) * Math.PI * 2 + thetaOffset;
            orientRadial(triBrush, triTheta, zLocal, radius - recessDepth);
            // rotate so base vertical, apex toward +theta
            const tangentDir = new THREE.Vector3(-Math.sin(triTheta), Math.cos(triTheta), 0);
            const radialDir = new THREE.Vector3(Math.cos(triTheta), Math.sin(triTheta), 0);
            const upDir = new THREE.Vector3(0, 0, 1);
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeBasis(tangentDir, upDir.clone().cross(tangentDir), radialDir);
            triBrush.setRotationFromMatrix(rotationMatrix);
            triBrush.updateMatrixWorld(true);
            subtractBrushes.push(triBrush);
        }
    }

    // Evaluate base minus all subtractive features (cutout + indicators)
    const unionSubtract = balancedUnion(evaluator, subtractBrushes);
    const result = unionSubtract ? evaluator.evaluate(baseBrush, unionSubtract, SUBTRACTION) : baseBrush;
    result.updateMatrixWorld(true);
    group.add(result);

    // Now add braille dot meshes as raised features
    const dotSpacingLocal = toNumber(settings.dot_spacing, 2.54);
    const dotColAngleOffsets = [-(dotSpacingLocal / radius) / 2, (dotSpacingLocal / radius) / 2];
    const dotRowOffsets = [dotSpacingLocal, 0, -dotSpacingLocal];
    const dotIndexToRowCol = [ [0,0],[1,0],[2,0],[0,1],[1,1],[2,1] ];
    const cellSpacingLocal = cellSpacing;
    const leftMarginLocal = leftMargin;
    const lineSpacingLocal = lineSpacing;
    const circumference = Math.PI * diameter;
    const cylinderHeight = toNumber(settings.emboss_dot_cylinder_height || settings.emboss_dot_height, 0.1);
    const domeHeight = toNumber(settings.emboss_dot_dome_height || 0.5, 0.5);
    const totalDotHeight = cylinderHeight + domeHeight;
    // Position dots so their base touches the cylinder surface
    const baseRadialDistance = radius;
    const dotGeom = createDotGeometry(settings);

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const brailleText = (translatedLines[rowIdx] || '').slice(0, availableColumns);
        const yLocalPlanar = toNumber(settings.card_height, 54) - toNumber(settings.top_margin, 8) - (rowIdx * lineSpacingLocal) + yAdjust;
        for (let col = 0; col < brailleText.length; col++) {
            const ch = brailleText[col];
            const dots = brailleUnicodeToDots(ch);
            const xCell = leftMarginLocal + ((col + 1) * cellSpacingLocal) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            for (let i = 0; i < 6; i++) {
                if (!dots[i]) continue;
                const [r, c] = dotIndexToRowCol[i];
                const theta = baseTheta + dotColAngleOffsets[c];
                const rHat = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
                const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), rHat);
                const mesh = new THREE.Mesh(dotGeom, material);
                mesh.setRotationFromQuaternion(q);
                const zLocal = (yLocalPlanar + dotRowOffsets[r]) + zCenterOffset;
                mesh.position.set(rHat.x * baseRadialDistance, rHat.y * baseRadialDistance, zLocal);
                group.add(mesh);
            }
        }
    }

    return group;
}

// --- Helpers ---
function balancedUnion(evaluator, brushes) {
    if (!brushes || brushes.length === 0) return null;
    let level = brushes.slice();
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            if (i + 1 < level.length) {
                next.push(evaluator.evaluate(level[i], level[i + 1], ADDITION));
            } else {
                next.push(level[i]);
            }
        }
        level = next;
    }
    return level[0];
}

function createTriangleShape(baseHeight, triangleWidth) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -baseHeight / 2);
    shape.lineTo(0, baseHeight / 2);
    shape.lineTo(triangleWidth, 0);
    shape.closePath();
    return shape;
}

function createRectangleShape(width, height) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(0, height);
    shape.closePath();
    return shape;
}

// Counter plate (flat card): subtract hemispherical recesses and recessed indicators
export function buildCardCounterPlate(settings) {
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();

    const baseGeometry = createBasePlateGeometry(settings);
    const baseBrush = new Brush(baseGeometry, material);
    baseBrush.position.set(
        toNumber(settings.card_width, 86) / 2,
        toNumber(settings.card_height, 54) / 2,
        toNumber(settings.card_thickness, 1.6) / 2
    );
    baseBrush.updateMatrixWorld(true);

    // Layout
    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColOffsets = [-dotSpacing / 2, dotSpacing / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    // Dot recess parameters
    const cylinderDiameter = toNumber(settings.emboss_dot_cylinder_diameter || settings.emboss_dot_base_diameter, 1.5);
    const recessOffset = toNumber(settings.counter_plate_dot_size_offset, 0.2);
    const dotRadius = Math.max(0.3, cylinderDiameter / 2 + recessOffset);

    const t = toNumber(settings.card_thickness, 1.6);
    const recessDepth = Math.min(0.8, Math.max(0.2, toNumber(settings.indicator_recess_depth, 0.5)));

    const subtractBrushes = [];

    // All dot recess spheres
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        // For counter plate, we allocate full grid regardless of text; recess layout is uniform
        const yPos = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < availableColumns; col++) {
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            for (let c = 0; c < 2; c++) {
                for (let r = 0; r < 3; r++) {
                    const x = xCell + dotColOffsets[c];
                    const y = yPos + dotRowOffsets[r];
                    const sphere = new THREE.SphereGeometry(dotRadius, 16, 12);
                    const brush = new Brush(sphere, material);
                    // Place sphere center slightly below top surface to create recess
                    brush.position.set(x, y, t - dotRadius * 0.75);
                    brush.updateMatrixWorld(true);
                    subtractBrushes.push(brush);
                }
            }
        }
    }

    // Indicator shapes per row
    const rectWidth = dotSpacing;
    const rectHeight = 2 * dotSpacing;
    const triBaseHeight = 2 * dotSpacing;
    const triWidth = dotSpacing;

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yPos = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;

        // Start-of-row rectangle: base on left column of first cell
        {
            const shape = createRectangleShape(rectWidth, rectHeight);
            const geom = new THREE.ExtrudeGeometry(shape, { depth: recessDepth, bevelEnabled: false });
            const brush = new Brush(geom, material);
            const xCellStart = leftMargin + xAdjust - dotSpacing / 2;
            brush.position.set(xCellStart, yPos - dotSpacing, t - recessDepth);
            brush.updateMatrixWorld(true);
            subtractBrushes.push(brush);
        }

        // End-of-row triangle: base on left, pointing right at last cell
        {
            const shape = createTriangleShape(triBaseHeight, triWidth);
            const geom = new THREE.ExtrudeGeometry(shape, { depth: recessDepth, bevelEnabled: false });
            const brush = new Brush(geom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const triX = xCellEnd - dotSpacing / 2;
            brush.position.set(triX, yPos, t - recessDepth);
            brush.updateMatrixWorld(true);
            subtractBrushes.push(brush);
        }
    }

    const unionSubtract = balancedUnion(evaluator, subtractBrushes);
    const result = unionSubtract ? evaluator.evaluate(baseBrush, unionSubtract, SUBTRACTION) : baseBrush;

    const group = new THREE.Group();
    result.updateMatrixWorld(true);
    group.add(result);
    return group;
}

// Counter plate (cylinder): subtract hemispherical recesses, indicators, and optional polygonal cutout
export function buildCylinderCounterPlate(settings, cylinderParams = {}) {
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const radius = diameter / 2;

    // Base cylinder brush (axis along Z)
    const cylGeometry = new THREE.CylinderGeometry(radius, radius, height, 96, 1, false);
    cylGeometry.rotateX(Math.PI / 2);
    const baseBrush = new Brush(cylGeometry, material);
    baseBrush.updateMatrixWorld(true);

    const subtractBrushes = [];

    // Optional polygonal cutout (12-gon), subtract along cylinder axis (Z), rotated to seam offset
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);
    if (cutoutInscribed > 0) {
        const sides = 12;
        const shape2d = new THREE.Shape();
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const x = Math.cos(angle) * cutoutInscribed;
            const y = Math.sin(angle) * cutoutInscribed;
            if (i === 0) shape2d.moveTo(x, y); else shape2d.lineTo(x, y);
        }
        shape2d.closePath();
        const cutoutGeom = new THREE.ExtrudeGeometry(shape2d, { depth: height + 2, bevelEnabled: false });
        // Extrude along +Z, then rotate around Z so one flat aligns with seam offset
        cutoutGeom.translate(0, 0, - (height + 2) / 2);
        cutoutGeom.rotateZ(thetaOffset);
        const cutoutBrush = new Brush(cutoutGeom, material);
        cutoutBrush.updateMatrixWorld(true);
        subtractBrushes.push(cutoutBrush);
    }

    // Layout for dots and indicators
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const leftMargin = toNumber(settings.left_margin, 8);
    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const circumference = Math.PI * diameter;
    const thetaOffset = toNumber(cylinderParams.seam_offset_deg, 355) * Math.PI / 180;

    const zCenterOffset = -height / 2;
    const rowsSpan = (gridRows - 1) * lineSpacing;

    // Dot recess parameters (hemispherical/sub-spherical)
    const cylinderDiameter = toNumber(settings.emboss_dot_cylinder_diameter || settings.emboss_dot_base_diameter, 1.5);
    const recessOffset = toNumber(settings.counter_plate_dot_size_offset, 0.2);
    const dotRadius = Math.max(0.3, cylinderDiameter / 2 + recessOffset);

    function orientRadial(mesh, theta, zWorld, radialDistance) {
        const rHat = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), rHat);
        mesh.setRotationFromQuaternion(q);
        const xWorld = rHat.x * radialDistance;
        const yWorld = rHat.y * radialDistance;
        mesh.position.set(xWorld, yWorld, zWorld);
        mesh.updateMatrixWorld(true);
    }

    const recessDepth = Math.min(0.8, Math.max(0.2, toNumber(settings.indicator_recess_depth, 0.5)));
    const rectWidth = dotSpacing;
    const rectHeight = 2 * dotSpacing;
    const triBaseHeight = 2 * dotSpacing;
    const triWidth = dotSpacing;

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yLocal = (height / 2) + yAdjust + (rowsSpan / 2 - rowIdx * lineSpacing);
        const zLocal = yLocal + zCenterOffset;

        // Dot recesses for this row across all columns
        for (let col = 0; col < availableColumns; col++) {
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            const colAngleOffsets = [-(dotSpacing / radius) / 2, (dotSpacing / radius) / 2];
            for (let c = 0; c < 2; c++) {
                const theta = baseTheta + colAngleOffsets[c];
                for (let r = 0; r < 3; r++) {
                    const sphere = new THREE.SphereGeometry(dotRadius, 16, 12);
                    const brush = new Brush(sphere, material);
                    // Place sphere center slightly inside the cylinder to create recess
                    const centerRadial = radius - dotRadius * 0.75;
                    const zDot = zLocal + [dotSpacing, 0, -dotSpacing][r];
                    orientRadial(brush, theta, zDot, centerRadial);
                    subtractBrushes.push(brush);
                }
            }
        }

        // Start-of-row rectangle (base on left of first cell)
        {
            const rectShape = createRectangleShape(rectWidth, rectHeight);
            const rectGeom = new THREE.ExtrudeGeometry(rectShape, { depth: recessDepth, bevelEnabled: false });
            const rectBrush = new Brush(rectGeom, material);
            const xCellStart = leftMargin + xAdjust;
            const rectTheta = ((xCellStart - dotSpacing / 2) / circumference) * Math.PI * 2 + thetaOffset;
            // Position so recess depth sinks into wall
            orientRadial(rectBrush, rectTheta, zLocal - 0, radius - recessDepth);
            subtractBrushes.push(rectBrush);
        }

        // End-of-row triangle (base on left of last cell, pointing +theta/right)
        {
            const triShape = createTriangleShape(triBaseHeight, triWidth);
            const triGeom = new THREE.ExtrudeGeometry(triShape, { depth: recessDepth, bevelEnabled: false });
            const triBrush = new Brush(triGeom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const triTheta = ((xCellEnd - dotSpacing / 2) / circumference) * Math.PI * 2 + thetaOffset;
            orientRadial(triBrush, triTheta, zLocal, radius - recessDepth);
            // Rotate around radial axis so triangle base is vertical and apex points along +theta
            const tangentDir = new THREE.Vector3(-Math.sin(triTheta), Math.cos(triTheta), 0);
            const radialDir = new THREE.Vector3(Math.cos(triTheta), Math.sin(triTheta), 0);
            const upDir = new THREE.Vector3(0, 0, 1);
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeBasis(tangentDir, upDir.clone().cross(tangentDir), radialDir);
            triBrush.setRotationFromMatrix(rotationMatrix);
            triBrush.updateMatrixWorld(true);
            subtractBrushes.push(triBrush);
        }
    }

    const unionSubtract = balancedUnion(evaluator, subtractBrushes);
    const result = unionSubtract ? evaluator.evaluate(baseBrush, unionSubtract, SUBTRACTION) : baseBrush;
    const group = new THREE.Group();
    result.updateMatrixWorld(true);
    group.add(result);
    return group;
}

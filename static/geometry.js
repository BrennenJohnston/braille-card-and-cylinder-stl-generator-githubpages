// Geometry builders for client-side STL generation
// Uses three.js primitives to construct positive embossing plates for card and cylinder

import * as THREE from './three.module.js';
// Lightweight CSG for client-side booleans
// Uses three-bvh-csg on a CDN to avoid any backend dependency
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'https://cdn.jsdelivr.net/npm/three-bvh-csg@0.3.1/build/index.module.js';

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
    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const flatHat = toNumber(settings.emboss_dot_flat_hat, baseDiameter * 0.6);
    const height = toNumber(settings.emboss_dot_height, 0.6);
    const radialSegments = 16;
    const topRadius = Math.max(0, flatHat / 2);
    const bottomRadius = Math.max(0, baseDiameter / 2);
    // CylinderGeometry height is along +Y. Rotate so height aligns with +Z for card dots.
    const geom = new THREE.CylinderGeometry(topRadius, bottomRadius, height, radialSegments, 1, false);
    geom.rotateX(Math.PI / 2);
    return geom;
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

    // Base plate (we'll carve recessed indicators into this using CSG)
    const baseGeom = createBasePlateGeometry(settings);
    const baseMeshPre = new THREE.Mesh(baseGeom, material);
    baseMeshPre.position.set(
        toNumber(settings.card_width, 86) / 2,
        toNumber(settings.card_height, 54) / 2,
        toNumber(settings.card_thickness, 1.6) / 2
    );

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
    const zTop = toNumber(settings.card_thickness, 1.6) + toNumber(settings.emboss_dot_height, 0.6) / 2;
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const dotGeom = createDotGeometry(settings);

    // Build recessed indicator shapes (triangle at last column, line/character at first) using CSG
    // Create a union of all indicator prisms, then subtract from the base
    const indicatorPrisms = [];

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

        // Add recessed triangle marker at the last cell position
        const xPosLast = leftMargin + ((toNumber(settings.grid_columns, 14) - 1) * cellSpacing) + xAdjust;
        const triShape = new THREE.Shape();
        const triBaseX = xPosLast - dotSpacing / 2;
        // Triangle sized to span top-bottom dots, apex at mid-right
        triShape.moveTo(triBaseX, yPos - dotSpacing);
        triShape.lineTo(triBaseX, yPos + dotSpacing);
        triShape.lineTo(triBaseX + dotSpacing, yPos);
        triShape.lineTo(triBaseX, yPos - dotSpacing);
        const recessDepth = Math.max(0.4, toNumber(settings.emboss_dot_height, 0.6) * 0.8);
        const triExtrude = new THREE.ExtrudeGeometry(triShape, { depth: recessDepth, bevelEnabled: false, steps: 1 });
        // Position so it bites into the top surface
        triExtrude.translate(0, 0, toNumber(settings.card_thickness, 1.6) - recessDepth);
        indicatorPrisms.push(triExtrude);

        // Add recessed line marker at the first cell position
        const xPosFirst = leftMargin + xAdjust;
        const lineWidth = dotSpacing * 0.65;
        const lineHeight = dotSpacing * 2.0;
        const rectShape = new THREE.Shape();
        rectShape.moveTo(xPosFirst - lineWidth / 2, yPos - lineHeight / 2);
        rectShape.lineTo(xPosFirst + lineWidth / 2, yPos - lineHeight / 2);
        rectShape.lineTo(xPosFirst + lineWidth / 2, yPos + lineHeight / 2);
        rectShape.lineTo(xPosFirst - lineWidth / 2, yPos + lineHeight / 2);
        rectShape.lineTo(xPosFirst - lineWidth / 2, yPos - lineHeight / 2);
        const rectExtrude = new THREE.ExtrudeGeometry(rectShape, { depth: Math.max(0.35, recessDepth * 0.8), bevelEnabled: false, steps: 1 });
        rectExtrude.translate(0, 0, toNumber(settings.card_thickness, 1.6) - Math.max(0.35, recessDepth * 0.8));
        indicatorPrisms.push(rectExtrude);
    }

    // Carve indicators from base using CSG (single subtraction of the union)
    let baseMesh;
    if (indicatorPrisms.length > 0) {
        const evaluator = new Evaluator();
        const baseBrush = new Brush(baseMeshPre.geometry.clone());
        // Build union of all indicators
        let unionBrush = null;
        for (let i = 0; i < indicatorPrisms.length; i++) {
            const brush = new Brush(indicatorPrisms[i]);
            unionBrush = unionBrush ? evaluator.evaluate(unionBrush, brush, ADDITION) : brush;
        }
        const carved = evaluator.evaluate(baseBrush, unionBrush, SUBTRACTION);
        baseMesh = new THREE.Mesh(carved.geometry, material);
        baseMesh.position.copy(baseMeshPre.position);
    } else {
        baseMesh = baseMeshPre;
    }
    group.add(baseMesh);

    return group;
}

export function buildCylinderEmbossingPlate(translatedLines, settings, cylinderParams = {}) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);

    const radius = diameter / 2;

    // Cylinder base oriented along Z (match backend STL orientation)
    const cylGeomY = new THREE.CylinderGeometry(radius, radius, height, 96, 1, false);
    cylGeomY.rotateX(Math.PI / 2);

    // Optional 12-gon cutout along cylinder axis
    let finalCylGeom = cylGeomY;
    if (cutoutInscribed > 0) {
        const n = 12;
        const circumscribed = cutoutInscribed / Math.cos(Math.PI / n);
        const shape = new THREE.Shape();
        for (let i = 0; i < n; i++) {
            const theta = (i / n) * Math.PI * 2;
            const x = circumscribed * Math.cos(theta);
            const y = circumscribed * Math.sin(theta);
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        const prism = new THREE.ExtrudeGeometry(shape, { depth: height + 2, bevelEnabled: false, steps: 1 });
        // Center the prism along Z
        prism.translate(0, 0, -(height + 2) / 2);
        // Convert to CSG and subtract
        const evaluator = new Evaluator();
        const cylBrush = new Brush(finalCylGeom.clone());
        const cutBrush = new Brush(prism);
        const sub = evaluator.evaluate(cylBrush, cutBrush, SUBTRACTION);
        finalCylGeom = sub.geometry;
    }
    const cylMesh = new THREE.Mesh(finalCylGeom, material);
    group.add(cylMesh);

    // Dot positioning constants
    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColAngleOffsets = [-(dotSpacing / radius) / 2, (dotSpacing / radius) / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const dotIndexToRowCol = [
        [0, 0], [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1]
    ];

    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const dotHeight = toNumber(settings.emboss_dot_height, 0.6);
    const centerRadialDistance = radius + dotHeight / 2;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;

    const dotGeom = createDotGeometry(settings);
    const zCenterOffset = -height / 2; // center cylinder along Z

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const brailleText = (translatedLines[rowIdx] || '').slice(0, availableColumns);
        const yLocal = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust; // planar Y maps to local Z

        for (let col = 0; col < brailleText.length; col++) {
            const ch = brailleText[col];
            const dots = brailleUnicodeToDots(ch);
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust; // planar X maps to angle

            const circumference = Math.PI * diameter;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;

            for (let i = 0; i < 6; i++) {
                if (!dots[i]) continue;
                const [r, c] = dotIndexToRowCol[i];
                const theta = baseTheta + dotColAngleOffsets[c];

                const rHat = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
                const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0);

                const mesh = new THREE.Mesh(dotGeom, material);
                // Rotate so +Z aligns with radial direction rHat
                const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), rHat);
                mesh.setRotationFromQuaternion(q);

                const zLocal = yLocal + dotRowOffsets[r] + zCenterOffset;
                const xWorld = rHat.x * centerRadialDistance;
                const yWorld = rHat.y * centerRadialDistance;
                mesh.position.set(xWorld, yWorld, zLocal);
                group.add(mesh);
            }
        }
    }

    return group;
}


// Counter plate (flat card): subtract hemispherical recesses at all dot positions
export function buildCardCounterPlate(settings) {
    const material = new THREE.MeshBasicMaterial();

    const baseGeom = createBasePlateGeometry(settings);
    const baseMeshPre = new THREE.Mesh(baseGeom, material);
    baseMeshPre.position.set(
        toNumber(settings.card_width, 86) / 2,
        toNumber(settings.card_height, 54) / 2,
        toNumber(settings.card_thickness, 1.6) / 2
    );

    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColOffsets = [-dotSpacing / 2, dotSpacing / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];

    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const gridRows = getGridRows(settings);
    const totalColumns = Number(settings.grid_columns || settings.gridColumns || 14);

    // Sphere radius equals embossing dot base diameter plus offset (diameter/2)
    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const r = Math.max(0.01, (baseDiameter + counterOffset) / 2);
    const sphereGeom = new THREE.SphereGeometry(r, 16, 12);
    const evaluator = new Evaluator();

    // Union all spheres first
    let unionBrush = null;
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yPos = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < totalColumns; col++) {
            const xCell = leftMargin + (col * cellSpacing) + xAdjust;
            for (let i = 0; i < 6; i++) {
                const [rIdx, cIdx] = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]][i];
                const x = xCell + dotColOffsets[cIdx];
                const y = yPos + dotRowOffsets[rIdx];
                const g = sphereGeom.clone();
                // Center at plate top so lower hemisphere recesses into the surface
                const zCenter = toNumber(settings.card_thickness, 1.6) - r + 1e-3;
                g.translate(x, y, zCenter);
                const brush = new Brush(g);
                unionBrush = unionBrush ? evaluator.evaluate(unionBrush, brush, ADDITION) : brush;
            }
        }
    }

    const baseBrush = new Brush(baseMeshPre.geometry.clone());
    const carved = unionBrush ? evaluator.evaluate(baseBrush, unionBrush, SUBTRACTION) : baseBrush;
    const finalMesh = new THREE.Mesh(carved.geometry, material);
    finalMesh.position.copy(baseMeshPre.position);

    const group = new THREE.Group();
    group.add(finalMesh);
    return group;
}

// Counter plate (cylinder): subtract hemispherical recesses and optional 12-gon cutout
export function buildCylinderCounterPlate(settings, cylinderParams = {}) {
    const material = new THREE.MeshBasicMaterial();

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);
    const radius = diameter / 2;

    // Start from cylinder shell
    let cylGeom = new THREE.CylinderGeometry(radius, radius, height, 96, 1, false);
    cylGeom.rotateX(Math.PI / 2);

    // Subtract polygonal cutout if requested
    if (cutoutInscribed > 0) {
        const n = 12;
        const circumscribed = cutoutInscribed / Math.cos(Math.PI / n);
        const shape = new THREE.Shape();
        for (let i = 0; i < n; i++) {
            const theta = (i / n) * Math.PI * 2;
            const x = circumscribed * Math.cos(theta);
            const y = circumscribed * Math.sin(theta);
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        const prism = new THREE.ExtrudeGeometry(shape, { depth: height + 2, bevelEnabled: false, steps: 1 });
        prism.translate(0, 0, -(height + 2) / 2);
        const evaluator = new Evaluator();
        const cylBrush = new Brush(cylGeom.clone());
        const cutBrush = new Brush(prism);
        const sub = evaluator.evaluate(cylBrush, cutBrush, SUBTRACTION);
        cylGeom = sub.geometry;
    }

    // Prepare to subtract hemispherical recesses from the cylinder surface
    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const r = Math.max(0.01, (baseDiameter + counterOffset) / 2);
    const sphereGeom = new THREE.SphereGeometry(r, 16, 12);

    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColAngleOffsets = [-(dotSpacing / radius) / 2, (dotSpacing / radius) / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const gridRows = getGridRows(settings);
    const totalColumns = Number(settings.grid_columns || settings.gridColumns || 14);

    const circumference = Math.PI * diameter;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;
    const centerRadialDistance = radius - r + 1e-3; // recess into the surface

    const evaluator = new Evaluator();
    let spheresUnion = null;

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yLocal = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < totalColumns; col++) {
            const xCell = leftMargin + (col * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            for (let i = 0; i < 6; i++) {
                const [rIdx, cIdx] = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]][i];
                const theta = baseTheta + dotColAngleOffsets[cIdx];
                const rHat = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
                const zLocal = yLocal + dotRowOffsets[rIdx] - height / 2;
                const xWorld = rHat.x * centerRadialDistance;
                const yWorld = rHat.y * centerRadialDistance;
                const g = sphereGeom.clone();
                g.translate(xWorld, yWorld, zLocal);
                const brush = new Brush(g);
                spheresUnion = spheresUnion ? evaluator.evaluate(spheresUnion, brush, ADDITION) : brush;
            }
        }
    }

    const cylBrush = new Brush(cylGeom.clone());
    const carved = spheresUnion ? evaluator.evaluate(cylBrush, spheresUnion, SUBTRACTION) : cylBrush;
    const finalMesh = new THREE.Mesh(carved.geometry, material);
    const group = new THREE.Group();
    group.add(finalMesh);
    return group;
}

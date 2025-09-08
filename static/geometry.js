// Geometry builders for client-side STL generation
// Uses three.js primitives to construct positive embossing plates for card and cylinder

import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

// Helper to union many brushes using a balanced strategy to reduce CSG complexity
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
// Note: Removed external CSG dependency for maximum compatibility on static hosting (GitHub Pages).
// All geometry is now built using native THREE primitives only.

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

    // Build dot meshes for each translated character
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

    // Add base plate without recessed indicators (CSG removed)
    group.add(baseMeshPre);

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

    // Optional polygonal cutout: create an extruded 12-gon shaft and subtract via CSG if radius provided
    let finalCylGeom = cylGeomY;
    const cutoutRadius = Math.max(0, cutoutInscribed);
    if (cutoutRadius > 0) {
        // Build 2D 12-gon in XY plane, then extrude along Z to cylinder height
        const sides = 12;
        const shape2d = new THREE.Shape();
        for (let i = 0; i < sides; i++) {
            const theta = (i / sides) * Math.PI * 2;
            const x = Math.cos(theta) * cutoutRadius;
            const y = Math.sin(theta) * cutoutRadius;
            if (i === 0) shape2d.moveTo(x, y); else shape2d.lineTo(x, y);
        }
        shape2d.closePath();
        const extrudeGeom = new THREE.ExtrudeGeometry(shape2d, { depth: height + 2, bevelEnabled: false });
        // Center along Z so the cutout extrudes bottom-to-top along the cylinder axis (+Z)
        extrudeGeom.translate(0, 0, - (height + 2) / 2);

        // Use BVH CSG subtraction to create the hole
        const cylinderBrush = new Brush(cylGeomY, material);
        const cutoutBrush = new Brush(extrudeGeom, material);
        cylinderBrush.updateMatrixWorld(true);
        cutoutBrush.updateMatrixWorld(true);
        const evaluator = new Evaluator();
        const subtracted = evaluator.evaluate(cylinderBrush, cutoutBrush, SUBTRACTION);
        finalCylGeom = subtracted.geometry;
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

    // Base plate brush
    const baseGeometry = createBasePlateGeometry(settings);
    const baseBrush = new Brush(baseGeometry, material);
    baseBrush.position.set(
        toNumber(settings.card_width, 86) / 2,
        toNumber(settings.card_height, 54) / 2,
        toNumber(settings.card_thickness, 1.6) / 2
    );
    baseBrush.updateMatrixWorld(true);

    // Dot layout parameters
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

    // Sphere radius for recess (slightly oversized via offset if provided)
    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const sphereRadius = Math.max(0.01, (baseDiameter + counterOffset) / 2);
    const sphereSegmentsW = 12;
    const sphereSegmentsH = 8;

    // Sphere placed with center on the top surface (z = thickness) creates a hemispherical recess
    const plateThickness = toNumber(settings.card_thickness, 1.6);

    // Build all recess brushes
    const recessBrushes = [];
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yCellCenter = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;

        for (let col = 0; col < totalColumns; col++) {
            const xCellCenter = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 2; c++) {
                    const x = xCellCenter + dotColOffsets[c];
                    const y = yCellCenter + dotRowOffsets[r];
                    const z = plateThickness - 1e-3; // slight inward bias for robust CSG

                    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, sphereSegmentsW, sphereSegmentsH);
                    const sphereBrush = new Brush(sphereGeometry, material);
                    sphereBrush.position.set(x, y, z);
                    sphereBrush.updateMatrixWorld(true);
                    recessBrushes.push(sphereBrush);
                }
            }
        }
    }

    const evaluator = new Evaluator();

    // Union all spheres using balanced strategy to reduce complexity
    const unionBrush = balancedUnion(evaluator, recessBrushes);

    // If there are no recesses (edge case), just return the base
    if (!unionBrush) {
        const fallbackGroup = new THREE.Group();
        fallbackGroup.add(baseBrush);
        return fallbackGroup;
    }

    const resultBrush = evaluator.evaluate(baseBrush, unionBrush, SUBTRACTION);
    // Return as a group for consistency with callers
    const resultGroup = new THREE.Group();
    resultGroup.add(resultBrush);
    return resultGroup;
}

// Counter plate (cylinder): subtract hemispherical recesses and optional 12-gon cutout
export function buildCylinderCounterPlate(settings, cylinderParams = {}) {
    const material = new THREE.MeshBasicMaterial();

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const radius = diameter / 2;

    // Base cylinder brush (axis along Z)
    let cylGeometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, false);
    cylGeometry.rotateX(Math.PI / 2);
    const baseBrush = new Brush(cylGeometry, material);
    baseBrush.updateMatrixWorld(true);

    // Recess parameters
    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const sphereRadius = Math.max(0.01, (baseDiameter + counterOffset) / 2);
    const sphereSegmentsW = 12;
    const sphereSegmentsH = 8;

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

    // Build all recess brushes positioned on cylinder surface (slightly inside for robust subtraction)
    const recessBrushes = [];
    const zCenterOffset = -height / 2;
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yLocal = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;

        for (let col = 0; col < totalColumns; col++) {
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 2; c++) {
                    const theta = baseTheta + dotColAngleOffsets[c];
                    const radialDir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
                    const centerRadialDistance = radius - 1e-3; // center just inside the surface

                    const xWorld = radialDir.x * centerRadialDistance;
                    const yWorld = radialDir.y * centerRadialDistance;
                    const zWorld = (yLocal + dotRowOffsets[r] + zCenterOffset);

                    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, sphereSegmentsW, sphereSegmentsH);
                    const sphereBrush = new Brush(sphereGeometry, material);
                    sphereBrush.position.set(xWorld, yWorld, zWorld);

                    // Align sphere so its local +Z points along the outward radial direction (optional but keeps transforms consistent)
                    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), radialDir);
                    sphereBrush.setRotationFromQuaternion(q);
                    sphereBrush.updateMatrixWorld(true);
                    recessBrushes.push(sphereBrush);
                }
            }
        }
    }

    const evaluator = new Evaluator();
    const unionBrush = balancedUnion(evaluator, recessBrushes);

    if (!unionBrush) {
        const fallbackGroup = new THREE.Group();
        fallbackGroup.add(baseBrush);
        return fallbackGroup;
    }

    const resultBrush = evaluator.evaluate(baseBrush, unionBrush, SUBTRACTION);
    const resultGroup = new THREE.Group();
    resultGroup.add(resultBrush);
    return resultGroup;
}

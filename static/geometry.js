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

function createUnifiedRecessGeometry(cylinderRadius, cylinderHeight, domeHeight, segments = 16) {
    // Create a unified recess shape using LatheGeometry
    // This creates a single continuous surface that CSG can handle better
    
    const points = [];
    
    // Start at the cylinder edge at surface (NOT center - we want an open top)
    points.push(new THREE.Vector2(cylinderRadius, 0));
    
    // Move down the cylinder wall
    points.push(new THREE.Vector2(cylinderRadius, -cylinderHeight));
    
    // Create the dome curve at the bottom
    // Sample points along the dome curve
    const domeSamples = 12; // Increased for smoother curve
    for (let i = 0; i <= domeSamples; i++) {
        const angle = (i / domeSamples) * (Math.PI / 2); // 0 to 90 degrees
        const x = cylinderRadius * Math.cos(angle);
        const y = -cylinderHeight - (domeHeight * Math.sin(angle)); // Use sin for proper dome shape
        points.push(new THREE.Vector2(x, y));
    }
    
    // Create the lathe geometry - this will create an open-topped shape
    const geometry = new THREE.LatheGeometry(points, segments);
    
    console.log('LatheGeometry points:', {
        pointCount: points.length,
        segments: segments,
        firstPoint: [points[0].x, points[0].y],
        lastPoint: [points[points.length-1].x, points[points.length-1].y]
    });
    
    return geometry;
}

function createSphericalCapForRecess(baseRadius, recessDepth) {
    // Create a proper spherical cap geometry using LatheGeometry for manifold-safe results
    // This avoids issues with full sphere subtraction
    const a = baseRadius;
    const h = recessDepth;

    // Guard against invalid inputs
    if (!(a > 0) || !(h > 0)) {
        const fallbackR = Math.max(0.001, a || h || 0.5);
        return {
            geometry: new THREE.CylinderGeometry(fallbackR, fallbackR, 0.1, 16),
            radius: fallbackR,
            centerOffset: 0
        };
    }

    // Calculate sphere radius from cap parameters
    const R = (a * a + h * h) / (2 * h);
    const centerOffset = R - h;

    // Create profile points for LatheGeometry
    const points = [];
    
    // Start at the edge (at surface level)
    points.push(new THREE.Vector2(a, 0));
    
    // Create the spherical cap profile
    const numPoints = 20; // Increased for smoother curve
    for (let i = 1; i <= numPoints; i++) {
        // Calculate angle from edge to center bottom
        const t = i / numPoints;
        const angle = Math.asin(a / R); // Starting angle at edge
        const currentAngle = angle * (1 - t); // Interpolate to 0
        
        const x = R * Math.sin(currentAngle);
        const z = -R * (1 - Math.cos(currentAngle)); // Negative Z for depth
        
        points.push(new THREE.Vector2(x, z));
    }
    
    // Ensure we reach the center bottom
    points.push(new THREE.Vector2(0, -h));
    
    // Calculate segments for good resolution
    const circumference = 2 * Math.PI * a;
    const targetResolution = 0.2; // mm
    const segments = Math.max(16, Math.min(48, Math.round(circumference / targetResolution)));
    
    // Create the geometry using LatheGeometry
    const geometry = new THREE.LatheGeometry(points, segments);
    // Align Lathe axis (Y) to Z so depth is along -Z (into surface)
    geometry.rotateX(Math.PI / 2);
    
    console.log('Spherical cap parameters:', {
        openingRadius: a,
        openingDiameter: a * 2,
        depth: h,
        sphereRadius: R,
        sphereCenterOffset: centerOffset,
        segments: segments,
        profilePoints: points.length
    });

    return {
        geometry: geometry,
        radius: R,
        centerOffset: 0 // We align to Z and position explicitly where used
    };
}

function createRecessDotGeometry(settings) {
    // Creates simple hemispherical recesses using icospheres
    // This matches the working upstream implementation approach
    
    // Counter plate recess parameters
    const embossCylinderDiameter = toNumber(settings.emboss_dot_cylinder_diameter || settings.emboss_dot_base_diameter, 1.5);
    const offset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    
    // Use counter plate specific parameters if provided
    const openingDiameter = settings.counter_plate_dot_cylinder_diameter && settings.counter_plate_dot_cylinder_diameter.trim() !== '' 
        ? toNumber(settings.counter_plate_dot_cylinder_diameter, embossCylinderDiameter + offset)
        : embossCylinderDiameter + offset;
    
    const baseRadius = openingDiameter / 2;
    
    // Create simple icosphere (hemisphere) - much more reliable than compound geometry
    // Calculate appropriate resolution for manifold geometry
    const circumference = 2 * Math.PI * baseRadius;
    const targetResolution = 0.15; // mm
    const radialSegments = Math.max(12, Math.min(48, Math.round(circumference / targetResolution)));
    
    // Create icosphere that will be positioned with equator at surface level
    const sphereGeom = new THREE.SphereGeometry(baseRadius, radialSegments, radialSegments);
    
    console.log('Counter plate hemispherical recess dimensions:', {
        openingDiameter,
        baseRadius,
        circumference,
        radialSegments,
        actualResolution: circumference / radialSegments,
        targetResolution: targetResolution,
        geometryType: 'ICOSPHERE (HEMISPHERE)',
        shapeDescription: 'Simple icosphere positioned with equator at surface for clean subtraction'
    });
    
    return { 
        geometry: sphereGeom, 
        totalHeight: baseRadius, // Hemisphere height is just the radius
        cylinderRadius: baseRadius,
        sphereRadius: baseRadius,
        centerOffset: 0,
        cylinderHeight: 0 // No cylinder part in simple hemisphere
    };
}

function createDotGeometry(settings) {
    // Compound embossed dot shape: cylinder + dome (like a pole with rounded top)
    const cylinderDiameter = toNumber(settings.emboss_dot_cylinder_diameter || settings.emboss_dot_base_diameter, 1.5);
    const cylinderHeight = toNumber(settings.emboss_dot_cylinder_height || settings.emboss_dot_height, 0.1);
    const domeHeight = toNumber(settings.emboss_dot_dome_height || 0.5, 0.5);
    
    // Calculate appropriate resolution for manifold geometry
    const circumference = Math.PI * cylinderDiameter;
    const targetResolution = 0.15; // mm
    const radialSegments = Math.max(12, Math.min(32, Math.round(circumference / targetResolution)));
    
    // Create cylinder base (the "pole" part)
    const cylinderRadius = Math.max(0, cylinderDiameter / 2);
    const cylinderGeom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, radialSegments, 1, false);
    cylinderGeom.rotateX(Math.PI / 2);
    
    console.log('Embossed dot geometry parameters:', {
        cylinderDiameter: cylinderDiameter,
        cylinderHeight: cylinderHeight,
        domeHeight: domeHeight,
        circumference: circumference,
        radialSegments: radialSegments,
        actualResolution: circumference / radialSegments,
        targetResolution: targetResolution
    });
    
    // Create dome on top (the "rounded cap")
    // IMPORTANT: Dome base diameter MUST match cylinder diameter for proper connection
    const sphereRadius = cylinderRadius; // Ensures dome base perfectly matches cylinder
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, radialSegments, radialSegments);
    
    // Create clipping planes to cut the sphere in half
    const positions = sphereGeom.attributes.position;
    const uvs = sphereGeom.attributes.uv;
    const newPositions = [];
    const newUvs = [];
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
            
            // Transfer UV coordinates if they exist
            if (uvs) {
                newUvs.push(uvs.getX(i), uvs.getY(i));
            }
        }
    }
    
    // Create new geometry for the dome
    const domeGeom = new THREE.BufferGeometry();
    domeGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    
    // Add UV attribute if it exists in the source
    if (uvs && newUvs.length > 0) {
        domeGeom.setAttribute('uv', new THREE.Float32BufferAttribute(newUvs, 2));
    }
    
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
    
    // Combine UV coordinates if they exist
    const cylinderUvs = cylinderGeom.attributes.uv;
    const domeUvs = domeGeom.attributes.uv;
    
    if (cylinderUvs || domeUvs) {
        const mergedUvs = new Float32Array(totalVertices * 2);
        
        // Copy cylinder UVs if they exist
        if (cylinderUvs) {
            mergedUvs.set(cylinderUvs.array, 0);
        } else {
            // Generate default UVs for cylinder if missing
            const cylinderUvCount = cylinderGeom.attributes.position.count * 2;
            for (let i = 0; i < cylinderUvCount; i += 2) {
                mergedUvs[i] = 0.5;
                mergedUvs[i + 1] = 0.5;
            }
        }
        
        // Copy dome UVs if they exist
        const cylinderVertexCount = cylinderGeom.attributes.position.count;
        if (domeUvs) {
            mergedUvs.set(domeUvs.array, cylinderVertexCount * 2);
        } else {
            // Generate default UVs for dome if missing
            const domeUvStart = cylinderVertexCount * 2;
            const domeUvCount = domeGeom.attributes.position.count * 2;
            for (let i = 0; i < domeUvCount; i += 2) {
                mergedUvs[domeUvStart + i] = 0.5;
                mergedUvs[domeUvStart + i + 1] = 0.5;
            }
        }
        
        mergedGeom.setAttribute('uv', new THREE.BufferAttribute(mergedUvs, 2));
    }
    
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

    // Debug mode check
    const debugTriangleOnly = settings.debug_triangle_only || false;
    
    if (debugTriangleOnly) {
        console.log('DEBUG MODE: Triangle indicators only for card embossing plate');
    }

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

    // Skip dots if in debug triangle mode
    if (!debugTriangleOnly) {
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
    }

    return group;
}

export function buildCylinderEmbossingPlate(translatedLines, settings, cylinderParams = {}) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();

    // Debug mode check
    const debugTriangleOnly = settings.debug_triangle_only || false;
    
    if (debugTriangleOnly) {
        console.log('DEBUG MODE: Triangle indicators only for cylinder embossing plate');
    }

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);

    const radius = diameter / 2;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;

    // Base cylinder oriented along Z (match backend STL orientation) with optimized resolution
    const embossCircumference = 2 * Math.PI * radius;
    const targetResolution = 0.15; // mm
    const radialSegments = Math.max(32, Math.min(128, Math.round(embossCircumference / targetResolution)));
    
    const cylGeometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments, 1, false);
    cylGeometry.rotateX(Math.PI / 2);
    const baseBrush = new Brush(cylGeometry, material);
    
    console.log('Cylinder embossing plate base geometry:', {
        radius: radius,
        diameter: radius * 2, 
        circumference: embossCircumference,
        radialSegments: radialSegments,
        actualResolution: embossCircumference / radialSegments,
        targetResolution: targetResolution
    });
    baseBrush.updateMatrixWorld(true);

    const subtractBrushes = [];

    // Optional polygonal cutout (12-gon), subtract along cylinder axis (Z), rotated to seam offset
    // Skip cutout if in debug triangle mode
    if (cutoutInscribed > 0 && !debugTriangleOnly) {
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
        // Skip rectangle if in debug triangle mode
        if (!debugTriangleOnly) {
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
            
            // Debug logging for triangle parameters
            if (debugTriangleOnly && rowIdx === 0) {
                console.log('Triangle indicator debug (embossing plate):', {
                    rowIdx,
                    triBaseHeight,
                    triWidth,
                    recessDepth,
                    xCellEnd: leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust,
                    yLocal,
                    zLocal,
                    radius,
                    radialDistance: radius - recessDepth,
                    shapeVertices: triShape.getPoints ? triShape.getPoints().length : 'N/A',
                    triTheta: ((leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust - dotSpacing / 2) / (Math.PI * diameter)) * Math.PI * 2 + thetaOffset,
                    triThetaDegrees: (((leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust - dotSpacing / 2) / (Math.PI * diameter)) * Math.PI * 2 + thetaOffset) * 180 / Math.PI,
                    desiredOrientation: 'Base parallel to Z-axis (cylinder height), apex pointing tangentially'
                });
            }
            
            const triBrush = new Brush(triGeom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const triTheta = ((xCellEnd - dotSpacing / 2) / (Math.PI * diameter)) * Math.PI * 2 + thetaOffset;
            
            // Position and orient the triangle for recessing (Z-axis should point inward)
            // Triangle shape: base along Y-axis, apex along X-axis
            const rHat = new THREE.Vector3(Math.cos(triTheta), Math.sin(triTheta), 0);
            // Create quaternion that rotates Z-axis to point radially INWARD (opposite of orientRadial)
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), rHat.clone().negate());
            triBrush.setRotationFromQuaternion(q);
            const radialDistance = radius - recessDepth;
            triBrush.position.set(rHat.x * radialDistance, rHat.y * radialDistance, zLocal);
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
    // Skip dots if in debug triangle mode
    if (!debugTriangleOnly) {
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
    }

    return group;
}

// --- Helpers ---
function balancedUnion(evaluator, brushes) {
    if (!brushes || brushes.length === 0) return null;
    console.log(`Starting balanced union with ${brushes.length} brushes`);
    
    // Add small random offsets to avoid exact overlaps that cause CSG issues
    const epsilon = 1e-6; // Very small offset in mm
    brushes.forEach((brush, index) => {
        if (brush && brush.position) {
            // Add tiny random offset to break exact alignments
            brush.position.x += (Math.random() - 0.5) * epsilon;
            brush.position.y += (Math.random() - 0.5) * epsilon; 
            brush.position.z += (Math.random() - 0.5) * epsilon;
            brush.updateMatrixWorld(true);
        }
    });
    
    let level = brushes.slice();
    let iteration = 0;
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            if (i + 1 < level.length) {
                const united = evaluator.evaluate(level[i], level[i + 1], ADDITION);
                if (!united) {
                    console.error(`Failed to unite brushes ${i} and ${i+1} in iteration ${iteration}`);
                } else {
                    // Ensure updated matrix for next iteration
                    united.updateMatrixWorld(true);
                }
                next.push(united);
            } else {
                next.push(level[i]);
            }
        }
        level = next;
        iteration++;
    }
    console.log(`Balanced union completed after ${iteration} iterations`);
    return level[0];
}

function createTriangleShape(baseHeight, triangleWidth) {
    const shape = new THREE.Shape();
    // Create triangle matching upstream implementation:
    // Base is vertical (along Y-axis), apex points horizontally (along X-axis)
    // This creates the correct orientation for both card and cylinder plates
    const p1 = { x: -triangleWidth / 2, y: -baseHeight / 2 };  // Base bottom left
    const p2 = { x: -triangleWidth / 2, y: baseHeight / 2 };   // Base top left  
    const p3 = { x: triangleWidth / 2, y: 0 };                 // Apex pointing right
    
    shape.moveTo(p1.x, p1.y);
    shape.lineTo(p2.x, p2.y);
    shape.lineTo(p3.x, p3.y);
    shape.closePath();
    
    // Debug logging for triangle shape creation
    console.log('createTriangleShape (upstream corrected):', {
        baseHeight,
        triangleWidth,
        vertices: [p1, p2, p3],
        description: 'Triangle with base along Y-axis (vertical), apex pointing in +X direction (horizontal right)',
        coordinateSystem: 'Shape: Y=vertical (base), X=horizontal (apex), Z=extrude direction'
    });
    
    return shape;
}

function createRectangleShape(width, height) {
    const shape = new THREE.Shape();
    // Create rectangle centered at origin
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();
    return shape;
}

// Counter plate (flat card): subtract hemispherical recesses and recessed indicators
export function buildCardCounterPlate(settings) {
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();
    
    // Debug mode check
    const debugTriangleOnly = settings.debug_triangle_only || false;
    
    if (debugTriangleOnly) {
        console.log('DEBUG MODE: Triangle indicators only for card counter plate');
    }
    
    // Performance optimization for CSG operations
    if (settings.performance_mode) {
        evaluator.useGroups = false;
        evaluator.consolidateGroups = false;
    }

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
    const t = toNumber(settings.card_thickness, 1.6);
    const recessDepth = Math.min(0.8, Math.max(0.2, toNumber(settings.indicator_recess_depth, 0.5)));
    
    // Create recess dot geometry with new shape
    const recessDotResult = createRecessDotGeometry(settings);
    const recessDotGeometry = recessDotResult.geometry;
    const recessTotalHeight = recessDotResult.totalHeight;
    
    console.log('Using recess geometry for card counter plate:', {
        geometryVertices: recessDotGeometry.attributes.position.count,
        totalHeight: recessTotalHeight
    });

    const subtractBrushes = [];
    const dotBrush = new Brush(recessDotGeometry, material);
    dotBrush.updateMatrixWorld(true);
    
    console.log(`Building card counter plate with thickness ${t}mm, recess depth ${recessTotalHeight}mm`);
    console.log('Recess geometry info:', {
        vertices: recessDotGeometry.attributes.position.count,
        totalHeight: recessTotalHeight,
        radius: recessDotResult.cylinderRadius
    });
    
    // All dot recess shapes for counter plate
    // Skip dots if in debug triangle mode
    if (!debugTriangleOnly) {
        for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
            // For counter plate, we allocate full grid regardless of text; recess layout is uniform
            const yPos = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
            for (let col = 0; col < availableColumns; col++) {
                const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
                for (let c = 0; c < 2; c++) {
                    for (let r = 0; r < 3; r++) {
                        const x = xCell + dotColOffsets[c];
                        const y = yPos + dotRowOffsets[r];
                        const brush = dotBrush.clone();
                        // Position hemisphere with equator at surface level (z = t)
                        // This matches the upstream implementation
                        brush.position.set(x, y, t);
                        brush.updateMatrixWorld(true);
                        subtractBrushes.push(brush);
                    }
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

        // Start-of-row rectangle: positioned at the left of first cell
        // Skip rectangle if in debug triangle mode
        if (!debugTriangleOnly) {
            const shape = createRectangleShape(rectWidth, rectHeight);
            const geom = new THREE.ExtrudeGeometry(shape, { depth: recessDepth, bevelEnabled: false });
            const brush = new Brush(geom, material);
            const xCellStart = leftMargin + xAdjust - dotSpacing;
            const effectiveIndicatorDepth = Math.min(recessDepth, t * 0.8); // Max 80% of card thickness
            brush.position.set(xCellStart, yPos, t - effectiveIndicatorDepth);
            brush.updateMatrixWorld(true);
            subtractBrushes.push(brush);
        }

        // End-of-row triangle: positioned at the right of last cell, pointing right
        {
            const shape = createTriangleShape(triBaseHeight, triWidth);
            
            // Debug logging for triangle parameters
            if (debugTriangleOnly && rowIdx === 0) {
                console.log('Card counter plate triangle debug:', {
                    rowIdx,
                    triBaseHeight,
                    triWidth,
                    recessDepth,
                    xCellEnd: leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust,
                    yPos,
                    cardThickness: t,
                    effectiveIndicatorDepth: Math.min(recessDepth, t * 0.8),
                    zPosition: t - Math.min(recessDepth, t * 0.8),
                    shapePoints: shape.getPoints ? shape.getPoints().map(p => ({x: p.x, y: p.y})) : 'N/A',
                    orientation: 'Triangle base should be vertical (aligned with braille cell left edge), apex pointing right'
                });
            }
            
            const geom = new THREE.ExtrudeGeometry(shape, { depth: recessDepth, bevelEnabled: false });
            const brush = new Brush(geom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const effectiveIndicatorDepth = Math.min(recessDepth, t * 0.8); // Max 80% of card thickness
            
            // Position the triangle - for card plate, no rotation needed as triangle is already correctly oriented
            // Base is vertical (Y direction), apex points right (X direction) which matches braille row direction
            brush.position.set(xCellEnd, yPos, t - effectiveIndicatorDepth);
            brush.updateMatrixWorld(true);
            subtractBrushes.push(brush);
        }
    }

    console.log(`Card counter plate: ${subtractBrushes.length} subtract brushes created`);
    
    // For single brush test, skip union
    let subtractBrush;
    if (subtractBrushes.length === 1) {
        console.log('Single brush test - skipping union');
        subtractBrush = subtractBrushes[0];
    } else {
        const unionSubtract = balancedUnion(evaluator, subtractBrushes);
        console.log('Card plate union subtract result:', unionSubtract ? 'Created' : 'NULL');
        subtractBrush = unionSubtract;
    }
    
    const result = subtractBrush ? evaluator.evaluate(baseBrush, subtractBrush, SUBTRACTION) : baseBrush;
    console.log('Card plate CSG subtraction result:', result ? 'Success' : 'Failed');
    
    if (result) {
        console.log('Result geometry:', {
            vertices: result.geometry ? result.geometry.attributes.position.count : 'N/A'
        });
    }

    const group = new THREE.Group();
    result.updateMatrixWorld(true);
    group.add(result);
    return group;
}

// Counter plate (cylinder): subtract hemispherical recesses, indicators, and optional polygonal cutout
export function buildCylinderCounterPlate(settings, cylinderParams = {}) {
    const material = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();
    
    // Debug mode check
    const debugTriangleOnly = settings.debug_triangle_only || false;
    
    if (debugTriangleOnly) {
        console.log('DEBUG MODE: Triangle indicators only for cylinder counter plate');
    }
    
    // Performance optimization for CSG operations
    if (settings.performance_mode) {
        evaluator.useGroups = false;
        evaluator.consolidateGroups = false;
    }

    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const radius = diameter / 2;
    const thetaOffset = toNumber(cylinderParams.seam_offset_deg, 355) * Math.PI / 180;

    // Base cylinder brush (axis along Z) with optimized resolution for manifold geometry
    const counterCircumference = 2 * Math.PI * radius;
    const targetResolution = 0.15; // mm
    const radialSegments = Math.max(32, Math.min(128, Math.round(counterCircumference / targetResolution)));
    
    const cylGeometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments, 1, false);
    cylGeometry.rotateX(Math.PI / 2);
    const baseBrush = new Brush(cylGeometry, material);
    
    console.log('Cylinder counter plate base geometry:', {
        radius: radius,
        diameter: radius * 2,
        circumference: counterCircumference,
        radialSegments: radialSegments,
        actualResolution: counterCircumference / radialSegments,
        targetResolution: targetResolution
    });
    baseBrush.updateMatrixWorld(true);

    const subtractBrushes = [];

    // Optional polygonal cutout (12-gon), subtract along cylinder axis (Z), rotated to seam offset
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);
    // Skip cutout if in debug triangle mode
    if (cutoutInscribed > 0 && !debugTriangleOnly) {
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

    const zCenterOffset = -height / 2;
    const rowsSpan = (gridRows - 1) * lineSpacing;

    // Create recess dot geometry with new shape
    const recessDotResult = createRecessDotGeometry(settings);
    const recessDotGeometry = recessDotResult.geometry;
    const recessTotalHeight = recessDotResult.totalHeight;
    
    console.log('Using recess geometry for cylinder counter plate:', {
        geometryVertices: recessDotGeometry.attributes.position.count,
        totalHeight: recessTotalHeight,
        radius: recessDotResult.cylinderRadius
    });
    const dotBrush = new Brush(recessDotGeometry, material);
    dotBrush.updateMatrixWorld(true);

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
    
    // All dot recess shapes
    
    const rectWidth = dotSpacing;
    const rectHeight = 2 * dotSpacing;
    const triBaseHeight = 2 * dotSpacing;
    const triWidth = dotSpacing;

    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yLocal = (height / 2) + yAdjust + (rowsSpan / 2 - rowIdx * lineSpacing);
        const zLocal = yLocal + zCenterOffset;

        // Dot recesses for this row across all columns
        // Skip dots if in debug triangle mode
        if (!debugTriangleOnly) {
            for (let col = 0; col < availableColumns; col++) {
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            const colAngleOffsets = [-(dotSpacing / radius) / 2, (dotSpacing / radius) / 2];
            
            // Debug first recess position
            if (rowIdx === 0 && col === 0) {
                console.log('First recess position debug:', {
                    xCell,
                    baseTheta: baseTheta * 180 / Math.PI,
                    radius,
                    recessTotalHeight,
                    cylinderDiameter: recessDotResult.cylinderRadius ? recessDotResult.cylinderRadius * 2 : 'N/A',
                    recessGeometry: 'Spherical cap creating bowl shape'
                });
            }
            
            for (let c = 0; c < 2; c++) {
                const theta = baseTheta + colAngleOffsets[c];
                for (let r = 0; r < 3; r++) {
                    const brush = dotBrush.clone();
                    // Position hemisphere with equator at cylinder surface
                    const zDot = zLocal + [dotSpacing, 0, -dotSpacing][r];
                    
                    // Orient hemisphere radially outward from cylinder surface
                    // This matches the upstream implementation approach
                    orientRadial(brush, theta, zDot, radius);
                    subtractBrushes.push(brush);
                    }
                }
            }
        }

        // Start-of-row rectangle positioned at the left of first cell
        // Skip rectangle if in debug triangle mode
        if (!debugTriangleOnly) {
            const rectShape = createRectangleShape(rectWidth, rectHeight);
            const rectGeom = new THREE.ExtrudeGeometry(rectShape, { depth: recessDepth, bevelEnabled: false });
            const rectBrush = new Brush(rectGeom, material);
            const xCellStart = leftMargin + xAdjust - dotSpacing;
            const rectTheta = (xCellStart / circumference) * Math.PI * 2 + thetaOffset;
            // Position so recess depth sinks into wall
            orientRadial(rectBrush, rectTheta, zLocal, radius - recessDepth);
            subtractBrushes.push(rectBrush);
        }

        // End-of-row triangle positioned at the right of last cell, pointing right
        {
            const triShape = createTriangleShape(triBaseHeight, triWidth);
            
            // Debug logging for triangle parameters
            if (debugTriangleOnly && rowIdx === 0) {
                console.log('Cylinder counter plate triangle debug:', {
                    rowIdx,
                    triBaseHeight,
                    triWidth,
                    recessDepth,
                    xCellEnd: leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust,
                    triTheta: ((leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust) / circumference) * Math.PI * 2 + thetaOffset,
                    triThetaDegrees: (((leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust) / circumference) * Math.PI * 2 + thetaOffset) * 180 / Math.PI,
                    zLocal,
                    radius,
                    radialDistance: radius - recessDepth,
                    circumference,
                    desiredOrientation: 'Base parallel to Z-axis (cylinder height), apex pointing tangentially'
                });
            }
            
            const triGeom = new THREE.ExtrudeGeometry(triShape, { depth: recessDepth, bevelEnabled: false });
            const triBrush = new Brush(triGeom, material);
            const xCellEnd = leftMargin + ((availableColumns + 1) * cellSpacing) + xAdjust;
            const triTheta = (xCellEnd / circumference) * Math.PI * 2 + thetaOffset;
            
            // Position and orient the triangle for recessing (Z-axis should point inward)
            // Triangle shape: base along Y-axis, apex along X-axis
            const rHat = new THREE.Vector3(Math.cos(triTheta), Math.sin(triTheta), 0);
            // Create quaternion that rotates Z-axis to point radially INWARD (opposite of orientRadial)
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), rHat.clone().negate());
            triBrush.setRotationFromQuaternion(q);
            const radialDistance = radius - recessDepth;
            triBrush.position.set(rHat.x * radialDistance, rHat.y * radialDistance, zLocal);
            triBrush.updateMatrixWorld(true);
            subtractBrushes.push(triBrush);
        }
    }

    console.log(`Building cylinder counter plate with ${subtractBrushes.length} subtract brushes`);
    console.log('Cylinder dimensions:', { diameter, height, radius });
    console.log('Grid settings:', { availableColumns, gridRows, cellSpacing, lineSpacing, dotSpacing });
    console.log('Recess total height:', recessTotalHeight, 'mm');
    
    // For single brush test, skip union
    let subtractBrush;
    if (subtractBrushes.length === 1) {
        console.log('Single brush test - skipping union');
        subtractBrush = subtractBrushes[0];
    } else {
        const unionSubtract = balancedUnion(evaluator, subtractBrushes);
        console.log('Union subtract result:', unionSubtract ? 'Created' : 'NULL');
        subtractBrush = unionSubtract;
    }
    
    const result = subtractBrush ? evaluator.evaluate(baseBrush, subtractBrush, SUBTRACTION) : baseBrush;
    console.log('CSG subtraction result:', result ? 'Success' : 'Failed');
    
    if (result) {
        console.log('Result geometry:', {
            vertices: result.geometry ? result.geometry.attributes.position.count : 'N/A'
        });
    }
    const group = new THREE.Group();
    result.updateMatrixWorld(true);
    group.add(result);
    return group;
}

// Module Worker: OpenJSCAD-based STL generator
// Loads @jscad/modeling and @jscad/stl-serializer via ESM CDN (esm.sh) so no bundling is required.

// Import OpenJSCAD libraries from CDN as ESM
import { booleans, primitives, transforms, extrusions, text, geometries } from 'https://esm.sh/@jscad/modeling@2?bundle';
import { serializeText } from 'https://esm.sh/@jscad/stl-serializer@2?bundle';

const { union, subtract } = booleans;
const { cuboid, cylinder, sphere } = primitives;
const { translate, rotateX, rotateZ, rotateY } = transforms;
const { extrudeLinear } = extrusions;
const { vectorText } = text;
const { geom2 } = geometries;

function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function getAvailableColumns(settings) {
    const gridColumns = Number(settings.grid_columns || settings.gridColumns || 26);
    return Math.max(0, gridColumns - 2);
}

function getGridRows(settings) {
    return Number(settings.grid_rows || settings.gridRows || 4);
}

function brailleUnicodeToDots(ch) {
    const code = ch.codePointAt(0) || 0;
    const pattern = code - 0x2800;
    const dots = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) dots[i] = (pattern & (1 << i)) ? 1 : 0;
    return dots; // [1..6]
}

function buildCardPositive(translatedLines, settings) {
    const w = toNumber(settings.card_width, 86);
    const h = toNumber(settings.card_height, 54);
    const t = toNumber(settings.card_thickness, 1.6);

    // Base plate centered at origin
    let base = cuboid({ size: [w, h, t] });

    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColOffsets = [-dotSpacing / 2, dotSpacing / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const dotIndexToRowCol = [ [0,0], [1,0], [2,0], [0,1], [1,1], [2,1] ];

    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const dotHeight = toNumber(settings.emboss_dot_height, 0.6);
    const dotRadius = Math.max(0.01, baseDiameter / 2);
    const zTop = (t / 2) + (dotHeight / 2);

    const dots = [];
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const brailleText = (translatedLines[rowIdx] || '').slice(0, availableColumns);
        // Card Y axis: positive up; top edge is +h/2, so move down by topMargin, lineSpacing
        const yPos = (h / 2) - topMargin - (rowIdx * lineSpacing) + yAdjust;

        for (let col = 0; col < brailleText.length; col++) {
            const ch = brailleText[col];
            const dotsMask = brailleUnicodeToDots(ch);
            const xCell = (-w / 2) + leftMargin + ((col + 1) * cellSpacing) + xAdjust;

            for (let i = 0; i < 6; i++) {
                if (!dotsMask[i]) continue;
                const [r, c] = dotIndexToRowCol[i];
                const x = xCell + dotColOffsets[c];
                const y = yPos + dotRowOffsets[r];
                const dot = translate([x, y, zTop], cylinder({ height: dotHeight, radius: dotRadius, segments: 16 }));
                dots.push(dot);
            }
        }
    }

    // Add recessed indicators (triangle, rectangle, and optional text)
    const indicators = buildCardIndicatorCutters(settings);
    const textCutters = buildCardTextCutters(settings);
    const allCutters = indicators.concat(textCutters);
    if (allCutters.length > 0) {
        base = subtract(base, union(...allCutters));
    }

    if (dots.length > 0) {
        return union(base, ...dots);
    }
    return base;
}

function buildCardCounter(settings) {
    const w = toNumber(settings.card_width, 86);
    const h = toNumber(settings.card_height, 54);
    const t = toNumber(settings.card_thickness, 1.6);

    let base = cuboid({ size: [w, h, t] });

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

    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const sphereRadius = Math.max(0.01, (baseDiameter + counterOffset) / 2);

    const recesses = [];
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yCellCenter = (h / 2) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < totalColumns; col++) {
            const xCellCenter = (-w / 2) + leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 2; c++) {
                    const x = xCellCenter + dotColOffsets[c];
                    const y = yCellCenter + dotRowOffsets[r];
                    // center just at top surface to cut hemispherical recess
                    const z = (t / 2) - 0.001;
                    recesses.push(translate([x, y, z], sphere({ radius: sphereRadius, segments: 16 })));
                }
            }
        }
    }

    if (recesses.length > 0) {
        base = subtract(base, union(...recesses));
    }
    return base;
}

function buildCylinderPositive(translatedLines, settings, cylinderParams = {}) {
    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const radius = diameter / 2;

    let cyl = rotateX(Math.PI / 2, cylinder({ radius, height, segments: 96 }));

    const dotSpacing = toNumber(settings.dot_spacing, 2.54);
    const dotColAngleOffsets = [-(dotSpacing / radius) / 2, (dotSpacing / radius) / 2];
    const dotRowOffsets = [dotSpacing, 0, -dotSpacing];
    const leftMargin = toNumber(settings.left_margin, 8);
    const topMargin = toNumber(settings.top_margin, 8);
    const cellSpacing = toNumber(settings.cell_spacing, 6.0);
    const lineSpacing = toNumber(settings.line_spacing, 10.0);
    const xAdjust = toNumber(settings.braille_x_adjust, 0);
    const yAdjust = toNumber(settings.braille_y_adjust, 0);
    const availableColumns = getAvailableColumns(settings);
    const gridRows = getGridRows(settings);

    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const dotHeight = toNumber(settings.emboss_dot_height, 0.6);
    const dotRadius = Math.max(0.01, baseDiameter / 2);
    const centerRadialDistance = radius + dotHeight / 2;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;
    const circumference = Math.PI * diameter;
    const zCenterOffset = -height / 2;

    const dots = [];
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const brailleText = (translatedLines[rowIdx] || '').slice(0, availableColumns);
        const yLocal = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < brailleText.length; col++) {
            const ch = brailleText[col];
            const dotsMask = brailleUnicodeToDots(ch);
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 2; c++) {
                    if (!dotsMask[r + c*3]) continue;
                    const theta = baseTheta + dotColAngleOffsets[c];
                    const xWorld = Math.cos(theta) * centerRadialDistance;
                    const yWorld = Math.sin(theta) * centerRadialDistance;
                    const zWorld = yLocal + dotRowOffsets[r] + zCenterOffset;
                    // Dot oriented radially outward: approximate with small cylinder aligned along radial vector by rotating around Z
                    const dot = translate([xWorld, yWorld, zWorld], cylinder({ height: dotHeight, radius: dotRadius, segments: 16 }));
                    // Rotate cylinder so its axis points outward (around Z by theta)
                    const dotRotZ = rotateZ(theta, dot);
                    dots.push(dotRotZ);
                }
            }
        }
    }

    // Recessed indicators (triangle, rectangle, and optional text) carved into cylinder base before dot union
    const cutters = buildCylinderIndicatorCutters(settings, cylinderParams).concat(buildCylinderTextCutters(settings, cylinderParams));
    if (cutters.length > 0) {
        cyl = subtract(cyl, union(...cutters));
    }

    if (dots.length > 0) {
        return union(cyl, ...dots);
    }
    return cyl;
}

function buildCylinderCounter(settings, cylinderParams = {}) {
    const diameter = toNumber(cylinderParams.diameter_mm, 31.35);
    const height = toNumber(cylinderParams.height_mm, toNumber(settings.card_height, 54));
    const seamOffsetDeg = toNumber(cylinderParams.seam_offset_deg, 355);
    const radius = diameter / 2;

    let base = rotateX(Math.PI / 2, cylinder({ radius, height, segments: 96 }));

    // Optional polygonal cutout (12-gon) along cylinder axis
    const cutoutInscribed = toNumber(cylinderParams.polygonal_cutout_radius_mm, 0);
    if (cutoutInscribed > 0) {
        // Approximate 12-gon by subtracting 12 rotated rectangles around center to carve facets
        // Simpler alternative in JSCAD: subtract a slightly oversized cylinder scaled into a 12-gon via rotate+union of planes.
        // Here we approximate by union of 12 thin boxes forming a star, then subtract from base.
        const cutters = [];
        const facetThickness = cutoutInscribed * 2 + 2; // cover full diameter + small margin
        const boxDepth = height + 2; // ensure passes through
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            // each box is a plane approximating a side of the 12-gon
            const box = cuboid({ size: [facetThickness, 1, boxDepth] });
            const rot = rotateZ(angle, box);
            cutters.push(rot);
        }
        // Start from a solid disc slightly larger than inscribed radius and intersect with cutters to craft a 12-gon shaft.
        let shaft = cylinder({ radius: cutoutInscribed + 1, height: boxDepth, segments: 48 });
        shaft = rotateX(Math.PI / 2, shaft); // align with base (already along Z after rotateX)
        // Intersect is not imported; emulate by subtracting complement: not straightforward with current imports.
        // Instead, subtract a scaled cylinder to achieve a round shaft if cutters are not reliable in some engines.
        // Simpler, robust approach: subtract a cylinder with radius = cutoutInscribed, which yields round hole, acceptable fallback.
        // If strict polygon is required, replace this with modeling.intersections and a proper 12-gon prism.
        base = subtract(base, rotateX(Math.PI / 2, cylinder({ radius: cutoutInscribed, height: height + 2, segments: 12 })));
    }

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

    const baseDiameter = toNumber(settings.emboss_dot_base_diameter, 1.5);
    const counterOffset = toNumber(settings.counter_plate_dot_size_offset, 0.0);
    const sphereRadius = Math.max(0.01, (baseDiameter + counterOffset) / 2);

    const circumference = Math.PI * diameter;
    const thetaOffset = seamOffsetDeg * Math.PI / 180;
    const zCenterOffset = -height / 2;

    const recesses = [];
    for (let rowIdx = 0; rowIdx < gridRows; rowIdx++) {
        const yLocal = toNumber(settings.card_height, 54) - topMargin - (rowIdx * lineSpacing) + yAdjust;
        for (let col = 0; col < totalColumns; col++) {
            const xCell = leftMargin + ((col + 1) * cellSpacing) + xAdjust;
            const baseTheta = (xCell / circumference) * Math.PI * 2 + thetaOffset;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 2; c++) {
                    const theta = baseTheta + dotColAngleOffsets[c];
                    const xWorld = Math.cos(theta) * (radius - 0.001);
                    const yWorld = Math.sin(theta) * (radius - 0.001);
                    const zWorld = yLocal + dotRowOffsets[r] + zCenterOffset;
                    recesses.push(translate([xWorld, yWorld, zWorld], sphere({ radius: sphereRadius, segments: 16 })));
                }
            }
        }
    }

    if (recesses.length > 0) {
        base = subtract(base, union(...recesses));
    }
    return base;
}

async function generateSTL(payload) {
    const { plateType, shapeType, settings, cylinderParams, translatedLines } = payload;
    let geom;
    if (plateType === 'positive') {
        if (shapeType === 'cylinder') geom = buildCylinderPositive(translatedLines, settings, cylinderParams);
        else geom = buildCardPositive(translatedLines, settings);
    } else {
        if (shapeType === 'cylinder') geom = buildCylinderCounter(settings, cylinderParams);
        else geom = buildCardCounter(settings);
    }
    // Serialize to ASCII STL text
    const parts = serializeText({ binary: false, statusCallback: null, unit: 'millimeter' }, geom);
    const stlText = Array.isArray(parts) ? parts.join('') : String(parts || '');
    return stlText;
}

self.addEventListener('message', async (e) => {
    const { id, type, data } = e.data || {};
    try {
        if (type === 'generate') {
            const stlText = await generateSTL(data);
            self.postMessage({ id, type: 'generate', result: { success: true, stlText } });
        } else if (type === 'ping') {
            self.postMessage({ id, type: 'pong', result: { success: true } });
        } else {
            throw new Error('Unknown message type: ' + type);
        }
    } catch (err) {
        self.postMessage({ id, type, result: { success: false, error: err && err.message ? err.message : String(err) } });
    }
});



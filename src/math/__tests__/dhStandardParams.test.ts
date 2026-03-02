import { describe, it, expect } from "vitest";
import { computeStandardDHTable } from "../dhStandardParams";
import type { Joint, RotationAxis } from "../../core/types/robot";

function makeRevoluteJoint(
  rotationAxis: RotationAxis = "z",
  theta: number = 0,
  d: number = 0,
  a: number = 0,
  alpha: number = 0,
): Joint {
  return {
    id: crypto.randomUUID(),
    name: "Joint",
    elementKind: "joint",
    type: "revolute",
    dhParams: { theta, d, a, alpha },
    rotationAxis,
    frameAngle: 0,
    variableValue: 0,
    minLimit: -Math.PI,
    maxLimit: Math.PI,
  };
}

function makePrismaticJoint(
  rotationAxis: RotationAxis = "z",
  d: number = 0,
  variableValue: number = 0,
): Joint {
  return {
    id: crypto.randomUUID(),
    name: "Joint",
    elementKind: "joint",
    type: "prismatic",
    dhParams: { theta: 0, d, a: 0, alpha: 0 },
    rotationAxis,
    frameAngle: 0,
    variableValue,
    minLimit: -5,
    maxLimit: 5,
  };
}

function makeLinkElement(
  direction: "+x" | "-x" | "+y" | "-y" | "+z" | "-z",
  length: number,
): Joint {
  const map: Record<string, { axis: RotationAxis; sign: 1 | -1 }> = {
    "+x": { axis: "x", sign: 1 },
    "-x": { axis: "x", sign: -1 },
    "+y": { axis: "y", sign: 1 },
    "-y": { axis: "y", sign: -1 },
    "+z": { axis: "z", sign: 1 },
    "-z": { axis: "z", sign: -1 },
  };
  const { axis, sign } = map[direction]!;
  return {
    id: crypto.randomUUID(),
    name: "Link",
    elementKind: "link",
    type: "revolute",
    dhParams: { theta: 0, d: sign * length, a: 0, alpha: 0 },
    rotationAxis: axis,
    frameAngle: 0,
    variableValue: 0,
    minLimit: 0,
    maxLimit: 0,
  };
}

describe("computeStandardDHTable", () => {
  it("returns empty for no elements", () => {
    const rows = computeStandardDHTable([], "z");
    expect(rows).toHaveLength(0);
  });

  it("returns empty for only link elements", () => {
    const rows = computeStandardDHTable([makeLinkElement("+z", 1)], "z");
    expect(rows).toHaveLength(0);
  });

  it("single joint with no links: all d/a/alpha are 0", () => {
    const rows = computeStandardDHTable([makeRevoluteJoint("z")], "z");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.d).toBeCloseTo(0);
    expect(rows[0]!.a).toBeCloseTo(0);
    expect(rows[0]!.alpha).toBeCloseTo(0);
    expect(rows[0]!.index).toBe(1);
    expect(rows[0]!.isRevolute).toBe(true);
  });

  it("joints only (no links): d and a are 0, alpha from axis changes", () => {
    const elements = [
      makeRevoluteJoint("z"),
      makeRevoluteJoint("z"),
      makeRevoluteJoint("x"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(3);
    // z->z: alpha = 0
    expect(rows[0]!.alpha).toBeCloseTo(0);
    expect(rows[1]!.alpha).toBeCloseTo(0);
    // z->x: alpha = +pi/2
    expect(rows[2]!.alpha).toBeCloseTo(Math.PI / 2);
  });

  it("simple 2-joint chain with one perpendicular link between them", () => {
    const elements = [
      makeRevoluteJoint("z"),
      makeLinkElement("+x", 2),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(2);
    // Joint 1: a = 2 (link after it is +X, perpendicular to Z)
    expect(rows[0]!.d).toBeCloseTo(0);
    expect(rows[0]!.a).toBeCloseTo(2);
    expect(rows[0]!.alpha).toBeCloseTo(0);
    // Joint 2: no links after it
    expect(rows[1]!.d).toBeCloseTo(0);
    expect(rows[1]!.a).toBeCloseTo(0);
    expect(rows[1]!.alpha).toBeCloseTo(0);
  });

  it("link before first joint becomes d_1", () => {
    const elements = [
      makeLinkElement("+z", 1.5),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.d).toBeCloseTo(1.5);
    expect(rows[0]!.a).toBeCloseTo(0);
  });

  it("full 5-joint robot from the reference diagram", () => {
    const d = 0.5;
    const L1 = 1.0, L2 = 0.8, L3 = 1.2, L4 = 0.6, L5 = 0.9;

    const elements = [
      makeLinkElement("+z", d),     // d_1
      makeRevoluteJoint("z"),       // Joint 1
      makeLinkElement("+x", L1),    // a_1
      makeLinkElement("+z", L2),    // d_2
      makeRevoluteJoint("z"),       // Joint 2
      makeLinkElement("+x", L3),    // a_2
      makeLinkElement("+z", L4),    // d_3
      makeRevoluteJoint("z"),       // Joint 3
      makeLinkElement("+x", L5),    // a_3
      makeRevoluteJoint("x"),       // Joint 4 (axis change z->x)
      makeRevoluteJoint("x"),       // Joint 5 (same axis as 4)
    ];

    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(5);

    // Row 1: theta_1, alpha=0, r=L1, d=d
    expect(rows[0]!.index).toBe(1);
    expect(rows[0]!.d).toBeCloseTo(d);
    expect(rows[0]!.a).toBeCloseTo(L1);
    expect(rows[0]!.alpha).toBeCloseTo(0);

    // Row 2: theta_2, alpha=0, r=L3, d=L2
    expect(rows[1]!.index).toBe(2);
    expect(rows[1]!.d).toBeCloseTo(L2);
    expect(rows[1]!.a).toBeCloseTo(L3);
    expect(rows[1]!.alpha).toBeCloseTo(0);

    // Row 3: theta_3, alpha=0, r=L5, d=L4
    expect(rows[2]!.index).toBe(3);
    expect(rows[2]!.d).toBeCloseTo(L4);
    expect(rows[2]!.a).toBeCloseTo(L5);
    expect(rows[2]!.alpha).toBeCloseTo(0);

    // Row 4: theta_4, alpha=+pi/2, r=0, d=0
    expect(rows[3]!.index).toBe(4);
    expect(rows[3]!.d).toBeCloseTo(0);
    expect(rows[3]!.a).toBeCloseTo(0);
    expect(rows[3]!.alpha).toBeCloseTo(Math.PI / 2);

    // Row 5: theta_5, alpha=0, r=0, d=0
    expect(rows[4]!.index).toBe(5);
    expect(rows[4]!.d).toBeCloseTo(0);
    expect(rows[4]!.a).toBeCloseTo(0);
    expect(rows[4]!.alpha).toBeCloseTo(0);
  });

  it("multiple links along same axis between joints are summed", () => {
    const elements = [
      makeLinkElement("+z", 1),
      makeLinkElement("+z", 2),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows[0]!.d).toBeCloseTo(3);
  });

  it("mixed links between joints: Z-links become d, X-links become a", () => {
    const elements = [
      makeRevoluteJoint("z"),
      makeLinkElement("+x", 1.5),  // a_1 (perpendicular)
      makeLinkElement("+z", 2.0),  // d_2 (along Z)
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows[0]!.a).toBeCloseTo(1.5);
    expect(rows[1]!.d).toBeCloseTo(2.0);
  });

  it("trailing links after last joint do not affect the table", () => {
    const elements = [
      makeRevoluteJoint("z"),
      makeLinkElement("+x", 5),   // after last joint, perpendicular -> a_1
      makeLinkElement("+z", 10),  // after last joint, along Z -> ignored (no next joint)
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(1);
    // The +X link after the last joint still contributes to a_1
    expect(rows[0]!.a).toBeCloseTo(5);
    // The +Z link has no next joint to contribute d to, so it doesn't appear
    expect(rows[0]!.d).toBeCloseTo(0);
  });

  it("prismatic joint gets its own row with isPrismatic flag", () => {
    const elements = [
      makeLinkElement("+z", 1),
      makePrismaticJoint("z", 0.5),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isPrismatic).toBe(true);
    expect(rows[0]!.isRevolute).toBe(false);
    // d includes the link (abs) + joint's own d offset
    expect(rows[0]!.d).toBeCloseTo(1.5);
  });

  it("prismatic joint between revolute joints creates 3 rows", () => {
    const elements = [
      makeRevoluteJoint("z"),
      makePrismaticJoint("z", 0, 1.5),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.isRevolute).toBe(true);
    expect(rows[1]!.isPrismatic).toBe(true);
    expect(rows[2]!.isRevolute).toBe(true);
  });

  it("prismatic joint before revolute both generate rows", () => {
    const elements = [
      makePrismaticJoint("z", 0, 1.5),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.isPrismatic).toBe(true);
    expect(rows[1]!.isRevolute).toBe(true);
  });

  it("negative link d values produce positive d in DH table", () => {
    const elements = [
      makeLinkElement("-z", 0.3),
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(1);
    // Link is -z with length 0.3 -> dhParams.d = -0.3, but abs() gives 0.3
    expect(rows[0]!.d).toBeCloseTo(0.3);
  });

  it("negative link d values produce correct abs d in full robot chain", () => {
    // Same reference robot but with negative-direction Z links.
    // Z-links placed BEFORE the joint they serve (DH convention ordering).
    const d = 0.5;
    const L1 = 1.0, L2 = 0.8, L3 = 1.2, L4 = 0.6, L5 = 0.9;

    const elements = [
      makeLinkElement("-z", d),       // d_1 (negative dir, abs -> positive)
      makeRevoluteJoint("z"),         // Joint 1
      makeLinkElement("+x", L1),      // a_1
      makeLinkElement("-z", L2),      // d_2 (negative dir, abs -> positive)
      makeRevoluteJoint("z"),         // Joint 2
      makeLinkElement("+x", L3),      // a_2
      makeLinkElement("-z", L4),      // d_3 (negative dir, abs -> positive)
      makeRevoluteJoint("z"),         // Joint 3
      makeLinkElement("+x", L5),      // a_3
      makeRevoluteJoint("x"),         // Joint 4 (axis change z->x)
      makeRevoluteJoint("x"),         // Joint 5
    ];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows).toHaveLength(5);

    // All d values should be positive despite negative link directions
    expect(rows[0]!.d).toBeCloseTo(d);
    expect(rows[0]!.a).toBeCloseTo(L1);

    expect(rows[1]!.d).toBeCloseTo(L2);
    expect(rows[1]!.a).toBeCloseTo(L3);

    expect(rows[2]!.d).toBeCloseTo(L4);
    expect(rows[2]!.a).toBeCloseTo(L5);

    expect(rows[3]!.d).toBeCloseTo(0);
    expect(rows[3]!.alpha).toBeCloseTo(Math.PI / 2);

    expect(rows[4]!.d).toBeCloseTo(0);
    expect(rows[4]!.alpha).toBeCloseTo(0);
  });

  it("joint with built-in dhParams.a adds to accumulated a", () => {
    const elements = [
      makeRevoluteJoint("z", 0, 0, 0.5), // joint with a=0.5
      makeLinkElement("+x", 1),           // perpendicular link
      makeRevoluteJoint("z"),
    ];
    const rows = computeStandardDHTable(elements, "z");
    // a_1 = joint's own a (0.5) + link (+x, 1) = 1.5
    expect(rows[0]!.a).toBeCloseTo(1.5);
  });

  it("axis change x->z gives alpha = -pi/2", () => {
    const elements = [
      makeRevoluteJoint("x"),
      makeRevoluteJoint("z"),
    ];
    // With reference axis "x", first joint matches, alpha_1 = 0
    // Second joint x->z: cross(X, Z) = -Y, sign = -1, alpha = -pi/2
    const rows = computeStandardDHTable(elements, "x");
    expect(rows[0]!.alpha).toBeCloseTo(0);
    expect(rows[1]!.alpha).toBeCloseTo(-Math.PI / 2);
  });

  it("theta offset is preserved from joint dhParams", () => {
    const thetaConst = Math.PI / 4;
    const elements = [makeRevoluteJoint("z", thetaConst)];
    const rows = computeStandardDHTable(elements, "z");
    expect(rows[0]!.thetaOffset).toBeCloseTo(thetaConst);
  });

  // --- Common-normal convention tests ---

  describe("useCommonNormal = true (raw mode)", () => {
    it("z->x transition: adds theta_adj = pi/2, alpha stays pi/2", () => {
      const elements = [
        makeRevoluteJoint("z"),
        makeRevoluteJoint("x"),
      ];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows).toHaveLength(2);
      // Joint 1: z->z, no adjustment
      expect(rows[0]!.thetaOffset).toBeCloseTo(0);
      expect(rows[0]!.alpha).toBeCloseTo(0);
      // Joint 2: z->x, common-normal X_2 = Z x X = Y
      // theta_adj = angle from X_prev=[1,0,0] to X_new=[0,1,0] about Z = pi/2
      // alpha_std = angle from Z to X about Y = pi/2
      expect(rows[1]!.thetaOffset).toBeCloseTo(Math.PI / 2);
      expect(rows[1]!.alpha).toBeCloseTo(Math.PI / 2);
    });

    it("z->y transition: adds theta_adj = pi, alpha = pi/2", () => {
      const elements = [
        makeRevoluteJoint("z"),
        makeRevoluteJoint("y"),
      ];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows).toHaveLength(2);
      // Joint 2: z->y, common-normal X_2 = Z x Y = -X = [-1,0,0]
      // theta_adj = angle from [1,0,0] to [-1,0,0] about Z = pi
      // alpha_std = angle from Z to Y about -X = pi/2
      expect(rows[1]!.thetaOffset).toBeCloseTo(Math.PI);
      expect(rows[1]!.alpha).toBeCloseTo(Math.PI / 2);
    });

    it("x->z transition: adds theta_adj, positive alpha", () => {
      const elements = [
        makeRevoluteJoint("x"),
        makeRevoluteJoint("z"),
      ];
      const rows = computeStandardDHTable(elements, "x", true);
      expect(rows).toHaveLength(2);
      // Joint 2: x->z transition
      // Z_prev = X = [1,0,0], Z_curr = Z = [0,0,1]
      // Common normal = X_prev x Z_curr? No: X_prev cross Z_curr
      // Actually: Z_prev x Z_curr = [1,0,0] x [0,0,1] = [0,-1,0] = -Y
      // X_new = [0,-1,0]
      // Initial X for ref axis "x" is Y = [0,1,0]
      // theta_adj = angle from [0,1,0] to [0,-1,0] about [1,0,0] = pi
      expect(rows[1]!.thetaOffset).toBeCloseTo(Math.PI);
      // alpha_std = angle from [1,0,0] to [0,0,1] about [0,-1,0] = pi/2
      expect(rows[1]!.alpha).toBeCloseTo(Math.PI / 2);
    });

    it("same axis: no adjustment even with useCommonNormal", () => {
      const elements = [
        makeRevoluteJoint("z"),
        makeRevoluteJoint("z"),
      ];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows[0]!.thetaOffset).toBeCloseTo(0);
      expect(rows[0]!.alpha).toBeCloseTo(0);
      expect(rows[1]!.thetaOffset).toBeCloseTo(0);
      expect(rows[1]!.alpha).toBeCloseTo(0);
    });

    it("preserves d and a values with common-normal convention", () => {
      const elements = [
        makeLinkElement("+z", 1.5),
        makeRevoluteJoint("z"),
        makeLinkElement("+x", 2),
        makeRevoluteJoint("x"),
      ];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows[0]!.d).toBeCloseTo(1.5);
      expect(rows[0]!.a).toBeCloseTo(2);
      expect(rows[1]!.d).toBeCloseTo(0);
      expect(rows[1]!.a).toBeCloseTo(0);
    });
  });

  describe("useCommonNormal = true (remap mode - all same axis)", () => {
    it("negative alpha is flipped to positive with theta += pi", () => {
      const j = makeRevoluteJoint("z", 0, 0, 0, -Math.PI / 2);
      const elements = [j];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows[0]!.thetaOffset).toBeCloseTo(Math.PI);
      expect(rows[0]!.alpha).toBeCloseTo(Math.PI / 2);
    });

    it("positive alpha remains unchanged", () => {
      const j = makeRevoluteJoint("z", 0, 0, 0, Math.PI / 2);
      const elements = [j];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows[0]!.thetaOffset).toBeCloseTo(0);
      expect(rows[0]!.alpha).toBeCloseTo(Math.PI / 2);
    });

    it("zero alpha remains unchanged", () => {
      const j = makeRevoluteJoint("z", 0, 0, 0, 0);
      const elements = [j];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows[0]!.thetaOffset).toBeCloseTo(0);
      expect(rows[0]!.alpha).toBeCloseTo(0);
    });

    it("RPPR remap mode: flips Joint 2 negative alpha", () => {
      // Simulates the user's RPPR robot in remap mode
      const elements: Joint[] = [
        makeLinkElement("+z", 1),               // d1 link
        makeRevoluteJoint("z"),                  // Joint 1 (revolute)
        {                                        // Joint 2 (prismatic, alpha=-pi/2)
          ...makePrismaticJoint("z"),
          dhParams: { theta: 0, d: 0, a: 0, alpha: -Math.PI / 2 },
        },
        makePrismaticJoint("z"),                 // Joint 3 (prismatic)
        makeLinkElement("+z", 0.5),              // l4 link
        makeRevoluteJoint("z"),                  // Joint 4 (revolute)
      ];
      const rows = computeStandardDHTable(elements, "z", true);
      expect(rows).toHaveLength(4);
      // Joint 1: no alpha, no flip
      expect(rows[0]!.thetaOffset).toBeCloseTo(0);
      expect(rows[0]!.alpha).toBeCloseTo(0);
      // Joint 2: alpha was -pi/2 -> flipped to (theta+pi, pi/2)
      expect(rows[1]!.thetaOffset).toBeCloseTo(Math.PI);
      expect(rows[1]!.alpha).toBeCloseTo(Math.PI / 2);
      // Joint 3: no alpha, no flip
      expect(rows[2]!.thetaOffset).toBeCloseTo(0);
      expect(rows[2]!.alpha).toBeCloseTo(0);
      // Joint 4: no alpha, no flip
      expect(rows[3]!.thetaOffset).toBeCloseTo(0);
      expect(rows[3]!.alpha).toBeCloseTo(0);
    });
  });
});

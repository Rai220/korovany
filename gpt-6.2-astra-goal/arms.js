'use strict';

// The grip is calibrated from the Ranger's closed fingers. The two joints above that grip
// solve against a shoulder fixed to the camera, so neither a slash nor a shield hit can detach a sleeve.
class ViewArm {
  constructor() {
    const T = THREE,
      rig = borderCast.rigs.Male;
    this.group = new T.Group();
    const bones = rig.bones.map((name, i) => {
      const bone = new T.Bone();
      bone.name = name;
      bone.position.fromArray(rig.pos[i]);
      bone.quaternion.fromArray(rig.q[i]);
      return bone;
    });
    bones.forEach((b, i) => (rig.p[i] < 0 ? this.group : bones[rig.p[i]]).add(b));
    this.group.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones),
      get = (n) => bones[rig.bones.indexOf(n)];
    this.upper = get('upperarm_r');
    this.lower = get('lowerarm_r');
    this.wrist = get('hand_r');
    for (const [geometry, material] of ViewArm.geometry()) {
      const mesh = new T.SkinnedMesh(geometry, material);
      mesh.bind(skeleton);
      mesh.frustumCulled = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }

    const clip = borderCast.clips.Male.armed;
    clip.q.forEach((b, i) => {
      const q = castValues(b, Int16Array),
        f = Math.min(9, q.length / 4 - 1) * 4;
      bones[i].quaternion.set(q[f], q[f + 1], q[f + 2], q[f + 3]).normalize();
    });
    this.group.updateMatrixWorld(true);
    const pos = (b) => b.getWorldPosition(new T.Vector3());
    const grip = new T.Vector3();
    for (const finger of ['index', 'middle', 'ring', 'pinky']) {
      grip.add(pos(get(finger + '_01_r'))).add(pos(get(finger + '_02_r')));
    }
    grip.multiplyScalar(1 / 8);
    const up = pos(get('index_01_r'))
      .sub(pos(get('pinky_01_r')))
      .normalize();
    const fore = pos(this.lower).sub(grip);
    fore.addScaledVector(up, -fore.dot(up)).normalize();
    const cross = new T.Vector3().crossVectors(up, fore);
    const gripBasis = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(cross, up, fore));
    this.axis = new T.Vector3(0, 1, 0);
    this.pitchAxis = new T.Vector3(1, 0, 0);
    this.bodyPitch = 0;
    const intoWeapon = new T.Quaternion().setFromAxisAngle(this.axis, 0.5).multiply(gripBasis.invert());
    this.rest = [this.upper, this.lower, this.wrist].map((b) =>
      b.getWorldQuaternion(new T.Quaternion()).premultiply(intoWeapon),
    );
    this.wristToGrip = grip.sub(pos(this.wrist)).applyQuaternion(intoWeapon);
    // The hilt lies inside the curled fingers, between the knuckles and the palm.
    this.wristToGrip.z += 0.019;
    // Preserve the skin bind matrices when making the upper arm the root of the view model.
    this.group.attach(this.upper);
    this.group.remove(bones[0]);
    this.upperLength = this.lower.position.length();
    this.lowerLength = this.wrist.position.length();
    // Continue the fitted sleeve into the shoulder yoke. Its inner end is under the
    // collar, behind the near plane, even when the elbow crosses the centre of the frame.
    this.yoke = new T.Group();
    this.group.add(this.yoke);
    carved(this.yoke, (s) => {
      s.taper(0x414e58, [-0.025, -0.16, 0.13], [0.185, -0.015, 0.008], 0.13, 0.082);
      s.oval(0x414e58, 0.177, -0.013, 0.001, 0.09, 0.084, 0.097, 0.08, 0, -0.31);
    });
    this.shoulder = new T.Vector3();
    this.elbow = new T.Vector3();
    this.goal = new T.Vector3();
    this.wristGoal = new T.Vector3();
    this.direction = new T.Vector3();
    this.plane = new T.Vector3();
    this.tmp = new T.Vector3();
    this.axisFrom = new T.Vector3();
    this.rotation = new T.Quaternion();
    this.turn = new T.Quaternion();
    this.upperQ = new T.Quaternion();
    this.lowerQ = new T.Quaternion();
    this.handQ = new T.Quaternion();
  }
  static geometry() {
    if (this.buffers) return this.buffers;
    const groups = new Map(),
      rig = borderCast.rigs.Male;
    const upper = rig.bones.indexOf('upperarm_r');
    const belongs = rig.bones.map((n, i) => {
      for (let j = i; j >= 0; j = rig.p[j]) if (j === upper) return true;
      return false;
    });
    for (const [name, ids] of Object.entries(borderCast.parts.Male_Ranger)) {
      if (!name.endsWith('_Arms') && !name.endsWith('_Arms_Bracer')) continue;
      for (const id of ids) {
        const spec = borderCast.mesh[id],
          part = vertexPart(spec),
          indices = [];
        for (let i = 0; i < part.index.length; i += 3) {
          const a = part.index[i],
            b = part.index[i + 1],
            c = part.index[i + 2];
          if (part.position[a * 3] < 0 && part.position[b * 3] < 0 && part.position[c * 3] < 0)
            indices.push(a, b, c);
        }
        part.index = indices;
        for (let i = 0; i < part.skinIndex.length; i++)
          if (!belongs[part.skinIndex[i]]) part.skinIndex[i] = upper;
        if (!groups.has(spec.m)) groups.set(spec.m, []);
        groups.get(spec.m).push(part);
      }
    }
    const style = roleCostume('guard', 'hero');
    this.buffers = [...groups].map(([name, parts]) => {
      let mat = castSurface(name, style);
      if (name.includes('Regular')) {
        mat = new THREE.MeshStandardMaterial({
          map: texture('craft-finish'),
          color: 0x8a674d,
          normalMap: mat.normalMap,
          normalScale: new THREE.Vector2(0.47, -0.47),
          roughness: 0.81,
        });
        // The fingers retain their authored normal map; sample the leather swatch for their albedo.
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            'vec4 leatherGrain=texture2D(map, vec2(.005,.505)+fract(vMapUv*2.)*.485); diffuseColor.rgb*=.53+.98*sqrt(leatherGrain.r);',
          );
        };
      }
      return [combineCast(parts), mat];
    });
    return this.buffers;
  }
  aim(result, rest, targetDirection) {
    result.copy(this.rotation).multiply(rest);
    this.axisFrom.copy(this.axis).applyQuaternion(result);
    this.turn.setFromUnitVectors(this.axisFrom, targetDirection);
    result.premultiply(this.turn);
  }
  place(item, hand, lift = 0) {
    // Work in camera space mirrored to a single right-handed armature.
    this.group.visible = true;
    this.group.scale.x = hand;
    this.rotation.copy(item.quaternion);
    this.rotation.y *= hand;
    this.rotation.z *= hand;
    this.shoulder.set(0.195 - lift * 0.019, -0.262 + lift * 0.026, -0.019 - lift * 0.044);
    this.shoulder.applyAxisAngle(this.pitchAxis, -this.bodyPitch);
    this.yoke.rotation.x = -this.bodyPitch;
    this.yoke.position.copy(this.shoulder);
    this.yoke.position.x -= 0.177;
    this.goal.copy(item.position);
    this.goal.x *= hand;
    this.wristGoal.copy(this.wristToGrip).applyQuaternion(this.rotation).negate().add(this.goal);
    this.direction.copy(this.wristGoal).sub(this.shoulder);
    const d = this.direction.length();
    this.direction.multiplyScalar(1 / Math.max(d, 0.0001));
    const a = this.upperLength,
      b = this.lowerLength;
    const reach = THREE.MathUtils.clamp(d, 0.11, a + b - 0.003);
    this.goal.addScaledVector(this.direction, reach - d);
    this.wristGoal.copy(this.shoulder).addScaledVector(this.direction, reach);
    const along = (reach * reach + a * a - b * b) / (2 * reach);
    this.plane.set(0.42, -0.65, 0.12);
    this.plane.addScaledVector(this.direction, -this.plane.dot(this.direction)).normalize();
    this.elbow
      .copy(this.shoulder)
      .addScaledVector(this.direction, along)
      .addScaledVector(this.plane, Math.sqrt(Math.max(0, a * a - along * along)));
    this.aim(this.upperQ, this.rest[0], this.tmp.copy(this.elbow).sub(this.shoulder).normalize());
    this.aim(this.lowerQ, this.rest[1], this.tmp.copy(this.wristGoal).sub(this.elbow).normalize());
    this.handQ.copy(this.rotation).multiply(this.rest[2]);
    this.upper.position.copy(this.shoulder);
    this.upper.quaternion.copy(this.upperQ);
    this.lower.quaternion.copy(this.upperQ).invert().multiply(this.lowerQ);
    this.wrist.quaternion.copy(this.lowerQ).invert().multiply(this.handQ);
    item.position.copy(this.goal);
    item.position.x *= hand;
  }
}

// Reserve the front of the depth buffer for the camera rig. Fingers, leather and steel
// still occlude one another normally while a nearby actor or door cannot cut across a sleeve.
const viewMaterials = new WeakMap();
function prepareViewEquipment(...parts) {
  for (const part of parts)
    part.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = false;
      const source = mesh.material;
      if (!viewMaterials.has(source)) {
        const material = source.clone();
        const shaderKey = source.customProgramCacheKey();
        material.customProgramCacheKey = () => 'view-equipment:' + shaderKey;
        material.onBeforeCompile = (shader, renderer) => {
          source.onBeforeCompile(shader, renderer);
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n gl_Position.z = mix(-gl_Position.w, gl_Position.z, 0.035);',
          );
        };
        viewMaterials.set(source, material);
      }
      mesh.material = viewMaterials.get(source);
    });
}

// The first-person chest, belt, legs and boots use the same costume and walk cycle as
// the third-person hero. Exclude the head and arm polygons replaced by the two view rigs.
function createViewBody(side) {
  const body = appearance(heroRoles[side], 'hero', true);
  for (const mesh of [...body.children]) {
    if (!mesh.isSkinnedMesh) continue;
    const original = mesh.geometry;
    const { position, skinIndex, skinWeight } = original.attributes;
    const keepBone = mesh.skeleton.bones.map((b) =>
      /^(pelvis|spine|thigh|calf|foot|ball|toe|clavicle)/i.test(b.name),
    );
    const keep = new Uint8Array(position.count);
    for (let i = 0; i < keep.length; i++) {
      if (position.getY(i) > 1.595 || (position.getY(i) > 0.91 && Math.abs(position.getX(i)) > 0.215))
        continue;
      let weight = 0;
      for (let j = 0; j < 4; j++)
        if (keepBone[skinIndex.array[4 * i + j]]) weight += skinWeight.getComponent(i, j);
      keep[i] = Number(weight >= 0.48);
    }
    const source = original.index.array,
      faces = [];
    for (let i = 0; i < source.length; i += 3)
      if (keep[source[i]] && keep[source[i + 1]] && keep[source[i + 2]])
        faces.push(source[i], source[i + 1], source[i + 2]);
    if (!faces.length) {
      body.remove(mesh);
      continue;
    }
    const geometry = new THREE.BufferGeometry();
    for (const [key, value] of Object.entries(original.attributes)) geometry.setAttribute(key, value);
    geometry.setIndex(faces);
    mesh.geometry = geometry;
    mesh.frustumCulled = false;
  }
  prepareViewEquipment(body);
  body.userData.playerSide = side;
  return body;
}

// Hand targets are in metres from the camera. Rotations describe grip travel, then blade follow-through.
const fieldCuts = {
  light: [
    [0, 0, 0, 0, 0, 0, 0],
    [0.16, 0.014, 0.07, 0.075, 0.55, -0.25, -0.58],
    [0.4, -0.135, 0.12, -0.1, -0.2, 0.14, 0.9],
    [0.64, -0.215, 0.053, -0.078, -0.5, 0.32, 1.32],
    [1, 0, 0, 0, 0, 0, 0],
  ],
  heavy: [
    [0, 0, 0, 0, 0, 0, 0],
    [0.25, 0.04, 0.154, 0.105, 0.93, -0.23, -0.84],
    [0.43, -0.074, 0.123, -0.14, -0.32, 0.2, 0.42],
    [0.64, -0.233, -0.028, -0.107, -0.63, 0.4, 1.57],
    [0.8, -0.16, -0.041, -0.019, -0.32, 0.25, 0.9],
    [1, 0, 0, 0, 0, 0, 0],
  ],
};
function cutChannels(table, phase, out) {
  let i = 1;
  while (i < table.length - 1 && phase > table[i][0]) i++;
  const a = table[i - 1],
    b = table[i];
  const k = THREE.MathUtils.smoothstep(phase, a[0], b[0]);
  for (let j = 0; j < 6; j++) out[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * k;
}
function stepViewSpring(s, target, freq, dt) {
  const x = s.value - target,
    d = (s.speed + freq * x) * dt,
    e = Math.exp(-freq * dt);
  s.value = target + (x + d) * e;
  s.speed = (s.speed - freq * d) * e;
}

// Blend only the upper body into guard. The same lift curve drives both cameras,
// and the walking cycle keeps running underneath the strapped shield.
function poseGuardedHero(hero, state, t, impact, lift) {
  let pose = hero.userData.guardPose;
  if (!pose) {
    const sex = hero.userData.actorStyle.sex,
      rig = borderCast.rigs[sex],
      clip = borderCast.clips[sex].block;
    const joints = [
      ['spine_02', 0.48],
      ['spine_03', 0.7],
      ['clavicle_l', 1],
      ['upperarm_l', 1],
      ['lowerarm_l', 1],
      ['hand_l', 1],
      ['clavicle_r', 0.6],
      ['upperarm_r', 0.72],
      ['lowerarm_r', 0.72],
      ['hand_r', 0.72],
    ].map(([name, amount]) => {
      const values = castValues(clip.q[rig.bones.indexOf(name)], Int16Array);
      const at = Math.floor((values.length / 4 - 1) * 0.45) * 4;
      return {
        name,
        bone: hero.getObjectByName(name),
        amount,
        base: new THREE.Quaternion(),
        braced: new THREE.Quaternion().fromArray(values, at).normalize(),
      };
    });
    pose = hero.userData.guardPose = { joints, applied: false };
  }
  if (pose.applied) for (const j of pose.joints) j.bone.quaternion.copy(j.base);
  poseCharacter(hero, state, t);
  pose.applied = lift > 0.0001 || impact > 0.0001;
  if (!pose.applied) return;
  for (const j of pose.joints) {
    j.base.copy(j.bone.quaternion);
    j.bone.quaternion.slerp(j.braced, lift * j.amount);
    if (j.name === 'spine_03') j.bone.rotateX(impact * 0.34);
    if (j.name === 'upperarm_l') j.bone.rotateZ(impact * 0.68);
    if (j.name === 'lowerarm_l') j.bone.rotateX(-impact * 0.94);
  }
}

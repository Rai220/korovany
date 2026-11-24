'use strict';

// Experience is cumulative. Allocation is stored independently so training and loading never mint points twice.
const rankThresholds = [0, 65, 175, 335, 560, 855, 1230, 1710];
const rankTitles = [
  'Новичок',
  'Дозорный',
  'Проводник',
  'Испытанный',
  'Охотник на чудовищ',
  'Ветеран',
  'Мастер',
  'Легенда Пограничья',
];
const disciplines = [
  {
    name: 'Клинок',
    icon: 'swords',
    talents: [
      [
        'riposte',
        'Ответный удар',
        2,
        'После точного парирования следующий удар мечом наносит на 60% больше урона. Окно — три секунды.',
      ],
      [
        'breaker',
        'Раскол щита',
        3,
        'Тяжёлый удар пробивает костяную броню и стоит на 6 выносливости меньше.',
      ],
      [
        'blade',
        'Темп боя',
        5,
        'Попадание мечом по открывшемуся противнику возвращает 12 выносливости. Обычный удар стоит на 3 меньше.',
      ],
    ],
  },
  {
    name: 'Лук',
    icon: 'compass',
    talents: [
      ['focus', 'Верный глаз', 2, 'Выстрел с удержанием прицела наносит на 25% больше урона.'],
      [
        'pin',
        'Пригвоздить',
        3,
        'Первая стрела в противника на земле прерывает его атаку. Срабатывает раз в пять секунд на цель.',
      ],
      [
        'quiver',
        'Быстрый колчан',
        5,
        'Выстрел расходует 5 выносливости вместо 9. Лук готов к следующему выстрелу на треть быстрее.',
      ],
    ],
  },
  {
    name: 'Выживание',
    icon: 'tree',
    talents: [
      [
        'medic',
        'Полевая перевязка',
        2,
        'Бинт восстанавливает 54 здоровья. Максимум здоровья увеличен ещё на 10.',
      ],
      [
        'stride',
        'Лёгкий шаг',
        3,
        'Отскок стоит 15 выносливости вместо 24. Окно уклонения увеличено на треть.',
      ],
      [
        'bulwark',
        'Закалка',
        5,
        'Входящий урон снижен на 24%. Тяжёлая травма наступает на шестое попадание вместо четвёртого.',
      ],
    ],
  },
];
const talentBook = new Map(
  disciplines.flatMap((school) =>
    school.talents.map(([id, name, level, text], i) => [
      id,
      { id, name, level, text, requires: i ? school.talents[i - 1][0] : null },
    ]),
  ),
);
function newTraining() {
  return { xp: 0, learned: [], awards: [], last: null };
}
function validTraining(p) {
  return (
    p === undefined ||
    Boolean(
      p &&
      Number.isInteger(p.xp) &&
      p.xp >= 0 &&
      p.xp <= rankThresholds.at(-1) &&
      Array.isArray(p.learned) &&
      Array.isArray(p.awards) &&
      p.awards.every((x) => typeof x === 'string') &&
      new Set(p.learned).size === p.learned.length &&
      p.learned.length < rankFor(p.xp) &&
      p.learned.every((id) => {
        const t = talentBook.get(id);
        return t && t.level <= rankFor(p.xp) && (!t.requires || p.learned.includes(t.requires));
      }),
    )
  );
}
function rankFor(xp) {
  let i = 1;
  while (i < rankThresholds.length && xp >= rankThresholds[i]) i++;
  return i;
}
function heroLevel(g = game) {
  return rankFor(g?.training?.xp || 0);
}
function hasTalent(id, g = game) {
  return !!g?.training?.learned.includes(id);
}
function maxHealth(g = game) {
  return 100 + (heroLevel(g) - 1) * 6 + (hasTalent('medic', g) ? 10 : 0);
}
function talentPoints(g = game) {
  return heroLevel(g) - 1 - (g.training?.learned.length || 0);
}
function awardXP(amount, reason) {
  if (!game || !Number.isFinite(amount) || amount <= 0) return 0;
  const p = (game.training ??= newTraining()),
    before = p.xp,
    level = heroLevel(),
    healthCap = maxHealth();
  p.xp = Math.min(rankThresholds.at(-1), before + Math.trunc(amount));
  if (p.xp === before) return 0;
  p.last = { text: reason, amount: p.xp - before };
  game.xpAt = gameTime;
  if (heroLevel() > level) {
    game.health = Math.min(maxHealth(), game.health + maxHealth() - healthCap);
    scoreCue('chapter');
    game.rankUpAt = gameTime;
  }
  return p.xp - before;
}
function awardOnce(key, amount, reason) {
  const p = (game.training ??= newTraining());
  if (p.awards.includes(key)) return;
  p.awards.push(key);
  awardXP(amount, reason);
}
function trainingMilestones() {
  const g = game;
  const give = awardOnce;
  for (let i = 1; i <= Math.min(g.stage, 4); i++) give('side-' + i, 26, 'Служба фракции');
  const s = g.story;
  if (s.phase !== 'origin') give('mill-road', 30, 'След обоза');
  for (const clue of s.clues) give('clue-' + clue, 24, 'Новая улика');
  if (s.aid) give('witness', 28, 'Спасение свидетеля');
  if (s.herbs === 'done') give('herbs', 35, 'Белая трава');
  for (const mark of s.dairyStamps || []) give('stamp-' + mark, 14, 'Дорожная застава');
  if (s.branch) give('decision', 45, 'Судьба пропавшего зерна');
  if (s.phase === 'done') give('ending', 110, 'Завершение кампании');
}
function restoreTraining(g) {
  if (g.training) return;
  g.training = newTraining();
  // Old campaigns keep credit for victories, evidence and recovered relics.
  g.training.xp = Math.min(470, Math.max(0, g.kills || 0) * 12);
  const health = g.health;
  trainingMilestones();
  for (const [id, record] of Object.entries(g.undercrofts || {})) {
    if (record.unlocked) awardOnce('wheel-' + id, 20, 'Механизм открыт');
    if (record.claimed) awardOnce('vault-' + id, 65, 'Тайник экспедиции');
  }
  g.health = health;
  g.training.last = null;
}
function canLearn(id) {
  const t = talentBook.get(id);
  return (
    !!t &&
    !hasTalent(id) &&
    talentPoints() > 0 &&
    heroLevel() >= t.level &&
    (!t.requires || hasTalent(t.requires))
  );
}
function learnTalent(id) {
  if (!canLearn(id)) return false;
  const old = maxHealth();
  game.training.learned.push(id);
  game.health += maxHealth() - old;
  checkpoint();
  drawHud();
  return true;
}
function requiredRank(target) {
  return target.minLevel || (target.kind === 'sentinel' ? (game.dungeon === 'fort' ? 3 : 2) : 1);
}
function warded(target) {
  const required = requiredRank(target);
  if (required <= heroLevel()) return false;
  if (!Number.isFinite(game.wardWarningAt) || gameTime - game.wardWarningAt > 0.65) {
    notify('Древняя защита выдержала удар. Нужен уровень ' + required + ' · P — умения', 2.4);
    tone(137, 0.22, 'triangle', 0.09, 79);
    game.wardWarningAt = gameTime;
  }
  return true;
}
function trainedDamage(target, raw, type) {
  let dmg = raw + (heroLevel() - 1) * 2;
  if (type === 'arrow' && game.arrow?.aimed && hasTalent('focus')) dmg *= 1.25;
  if ((type === 'melee' || type === 'heavy') && game.riposteLeft > 0) {
    game.riposteLeft = 0;
    dmg *= 1.6;
  }
  if ((type === 'melee' || type === 'heavy') && hasTalent('blade') && target.stagger > 0)
    game.stamina = Math.min(100, game.stamina + 12);
  if (
    type === 'arrow' &&
    hasTalent('pin') &&
    target.kind !== 'dragon' &&
    !target.convoyPart &&
    (target.pinUntil ?? -1) <= gameTime
  ) {
    target.windup = 0;
    target.stagger = 1.0;
    target.pinUntil = gameTime + 5;
  }
  return Math.round(dmg);
}
function trainingHUD() {
  const p = game.training,
    level = heroLevel(),
    points = talentPoints(),
    next = rankThresholds[level] ?? p.xp;
  $('rank-key').textContent = 'Ур. ' + level + (points ? ' · ✦ ' + points : '') + '　P';
  $('rank-key').classList.toggle('unspent', points > 0);
  const toast = $('xp-event'),
    age = gameTime - (game.xpAt ?? -100);
  toast.hidden = !p.last || age >= 4.2 || age < 0;
  if (!toast.hidden)
    toast.textContent =
      (gameTime - (game.rankUpAt ?? -100) < 4.2 ? 'Уровень ' + level + ' · Новое умение　' : '') +
      '+' +
      p.last.amount +
      ' опыта · ' +
      p.last.text;
  $('rank-key').title = rankTitles[level - 1] + ' · ' + p.xp + ' / ' + next + ' опыта · Умения (P)';
}
function trainingDialog() {
  const p = game.training,
    level = heroLevel(),
    points = talentPoints(),
    next = rankThresholds[level],
    floor = rankThresholds[level - 1],
    pct = next ? (100 * (p.xp - floor)) / (next - floor) : 100;
  const tracks = disciplines
    .map(
      (school) =>
        '<section class="talent-path"><h3>' +
        icon(school.icon) +
        school.name +
        '</h3>' +
        school.talents
          .map(([id]) => {
            const t = talentBook.get(id),
              learned = hasTalent(id),
              available = canLearn(id);
            const label = learned
              ? 'Изучено'
              : level < t.level
                ? 'Уровень ' + t.level
                : t.requires && !hasTalent(t.requires)
                  ? 'Нужно «' + talentBook.get(t.requires).name + '»'
                  : available
                    ? 'Изучить · 1 очко'
                    : 'Требуется очко';
            return (
              '<button class="talent ' +
              (learned ? 'known' : available ? 'available' : '') +
              '" data-talent="' +
              id +
              '" ' +
              (available ? '' : 'disabled') +
              '><strong>' +
              t.name +
              '</strong><span>' +
              t.text +
              '</span><small>' +
              label +
              '</small></button>'
            );
          })
          .join('') +
        '</section>',
    )
    .join('');
  modal(
    'Уровень ' + level + ' из ' + rankThresholds.length,
    'Путь героя',
    '<div class="training-sheet"><div class="rank-summary"><div><small>' +
      sides[game.side].name +
      '</small><h3>' +
      rankTitles[level - 1] +
      '</h3><span>' +
      Math.ceil(game.health) +
      ' / ' +
      maxHealth() +
      ' здоровья　·　+' +
      (level - 1) * 2 +
      ' к урону</span></div><b>' +
      points +
      ' <small>очк. умений</small></b></div><div class="rank-meter"><i style="width:' +
      pct +
      '%"></i></div><p class="rank-legend">' +
      (next
        ? p.xp + ' / ' + next + ' опыта · следующий уровень ' + (level + 1)
        : 'Высший уровень · ' + p.xp + ' опыта') +
      '</p><div class="talent-grid">' +
      tracks +
      '</div><p class="rank-legend">Опыт приносят экспедиции, находки, заказы и победы. Если у чудовища древняя защита, в прицеле указан уровень, с которого её можно пробить.</p><button id="rank-expeditions" class="action">Найти экспедицию</button></div>',
  );
  $('rank-expeditions').onclick = () => journal('expeditions');
  for (const btn of document.querySelectorAll('[data-talent]'))
    btn.onclick = () => {
      if (learnTalent(btn.dataset.talent)) trainingDialog();
    };
}
function validAdventureSave(s) {
  const finite = Number.isFinite;
  if (s.hunts) {
    if (typeof s.hunts !== 'object' || Array.isArray(s.hunts)) return false;
    for (const [id, m] of Object.entries(s.hunts)) {
      const h = huntSites[id];
      if (
        !Object.hasOwn(huntSites, id) ||
        !m ||
        m.hunt !== id ||
        m.kind !== h.kind ||
        m.minLevel !== h.level ||
        ![m.x, m.z, m.hp, m.yaw, m.cd, m.timer].every(finite) ||
        m.hp < 0 ||
        m.hp > h.hp
      )
        return false;
    }
  }
  const d = s.dragon;
  if (
    d &&
    (d.kind !== 'dragon' ||
      d.minLevel !== 5 ||
      !Object.hasOwn(dragonMoves, d.mode) ||
      ![d.x, d.z, d.lift, d.anim, d.hp, d.left, d.span, d.phase].every(finite) ||
      d.hp < 0 ||
      d.hp > dragonHealth ||
      d.phase < 1 ||
      d.phase > 3)
  )
    return false;
  const field = s.exploration;
  if (
    field &&
    (!Array.isArray(field.visited) ||
      !field.visited.every((id) => Object.hasOwn(fieldSites, id)) ||
      !Array.isArray(field.paid) ||
      !field.paid.every((k) => typeof k === 'string') ||
      !field.choices ||
      typeof field.choices !== 'object' ||
      ![field.bearing, field.tilt].every(finite))
  )
    return false;
  const c = s.wagon?.convoy;
  return (
    !c ||
    (Array.isArray(c.archers) &&
      c.archers.length === 2 &&
      c.archers.every((a) => a && a.convoyPart === 'archer' && finite(a.hp)) &&
      Array.isArray(c.shots) &&
      c.shots.every((a) => a && [a.x, a.y, a.z].every(finite)) &&
      finite(c.axle) &&
      finite(c.speed))
  );
}

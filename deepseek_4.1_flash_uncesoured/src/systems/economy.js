// Экономика: товары, лавки с торгом, банк, трактир, обучение, протезирование.
import { G, emit, notify } from '../core/state.js';
import { clamp } from '../core/mathutil.js';
import { Rand } from '../core/rng.js';
import { gainGold, addItem, removeItem, installProsthetic, addXP } from '../entities/player.js';

export const ITEMS = {
  // --- оружие ---
  club: { name: 'Дубина', icon: '🏏', kind: 'weapon', price: 8, desc: 'Простое дерево. Бьёт больно.' },
  dagger: { name: 'Кинжал', icon: '🗡️', kind: 'weapon', price: 18, desc: 'Быстрый, но короткий.' },
  rusty_axe: { name: 'Ржавый топор', icon: '🪓', kind: 'weapon', price: 26, desc: 'Топор дровосека.' },
  iron_sword: { name: 'Железный меч', icon: '⚔️', kind: 'weapon', price: 75, desc: 'Надёжная сталь.' },
  spear: { name: 'Копьё', icon: '🔱', kind: 'weapon', price: 85, desc: 'Достаёт далеко.' },
  war_axe: { name: 'Боевой топор', icon: '🪓', kind: 'weapon', price: 165, desc: 'Рубит и щиты, и руки.' },
  staff: { name: 'Посох', icon: '🪄', kind: 'weapon', price: 130, desc: 'Эльфийская работа.' },
  steel_sword: { name: 'Булатный меч', icon: '⚔️', kind: 'weapon', price: 210, rare: true, desc: 'Острый, лёгкий, дорогой.' },
  elven_blade: { name: 'Эльфийский клинок', icon: '🗡️', kind: 'weapon', price: 260, rare: true, desc: 'Поёт в руке.' },
  dregar_blade: { name: '«Грызло» Дрегара', icon: '🗡️', kind: 'weapon', price: 520, rare: true, desc: 'Двуручный меч Владыки.' },
  hunting_bow: { name: 'Охотничий лук', icon: '🏹', kind: 'weapon', price: 55, desc: 'Для птицы и зайца.' },
  elven_bow: { name: 'Эльфийский лук', icon: '🏹', kind: 'weapon', price: 265, rare: true, desc: 'Бьёт дальше и больнее.' },
  war_bow: { name: 'Боевой лук', icon: '🏹', kind: 'weapon', price: 340, rare: true, desc: 'Пробивает кольчугу.' },
  // --- броня ---
  leather_armor: { name: 'Кожаный доспех', icon: '🥋', kind: 'armor', price: 85, armor: 0.12, desc: 'Легко и тихо.' },
  chain_armor: { name: 'Кольчуга', icon: '🛡️', kind: 'armor', price: 230, armor: 0.28, desc: 'Держит клинок.' },
  elven_mail: { name: 'Эльфийская кольчуга', icon: '🥋', kind: 'armor', price: 380, armor: 0.26, rare: true, desc: 'Почти невесома.' },
  plate_armor: { name: 'Латы', icon: '🛡️', kind: 'armor', price: 620, armor: 0.45, rare: true, desc: 'Тяжело, но надёжно.' },
  helmet_iron: { name: 'Шлем', icon: '⛑️', kind: 'armor', price: 65, armor: 0.06, slot: 'helmet', desc: 'Бережёт голову.' },
  helmet_great: { name: 'Большой шлем', icon: '⛑️', kind: 'armor', price: 210, armor: 0.12, slot: 'helmet', rare: true, desc: 'Почти башня.' },
  shield: { name: 'Щит', icon: '🛡️', kind: 'shield', price: 80, desc: 'Блок держит крепче.' },
  // --- зелья и еда ---
  potion_heal: { name: 'Зелье лечения', icon: '🧪', kind: 'potion', price: 38, heal: 50, desc: 'Затягивает раны.' },
  potion_stamina: { name: 'Зелье силы', icon: '🧪', kind: 'potion', price: 26, stamina: 60, desc: 'Возвращает выносливость.' },
  potion_blood: { name: 'Кровоостанавливающий отвар', icon: '🧪', kind: 'potion', price: 44, stopsBleeding: 3, desc: 'Останавливает кровь.' },
  elixir: { name: 'Эликсир целителя', icon: '⚗️', kind: 'potion', price: 130, cure: true, heal: 40, stopsBleeding: 4, rare: true, desc: 'Лечит всё, кроме отрубленного.' },
  bread: { name: 'Хлеб', icon: '🍞', kind: 'food', price: 4, food: 26, desc: 'Сытно.' },
  cheese: { name: 'Сыр', icon: '🧀', kind: 'food', price: 7, food: 30, desc: 'Мышиный рай.' },
  meat: { name: 'Жареное мясо', icon: '🍖', kind: 'food', price: 11, food: 50, desc: 'Для воина.' },
  apple: { name: 'Яблоко', icon: '🍎', kind: 'food', price: 2, food: 14, desc: 'Хруст.' },
  ale: { name: 'Эль', icon: '🍺', kind: 'food', price: 5, food: 18, stamina: 12, desc: 'Бодрит.' },
  // --- инструменты ---
  bandage: { name: 'Бинт', icon: '🩹', kind: 'tool', price: 7, stopsBleeding: 1.6, heal: 6, desc: 'Обязателен при отрубленной руке.' },
  lockpick: { name: 'Отмычка', icon: '🔑', kind: 'tool', price: 14, desc: 'Открывает сундуки.' },
  torch: { name: 'Факел', icon: '🔥', kind: 'tool', price: 5, desc: 'Светит в ночи.' },
  arrows: { name: 'Стрелы', icon: '➶', kind: 'ammo', price: 2, desc: 'Расходник лучника.' },
  // --- протезы ---
  hook_arm: { name: 'Железный крюк', icon: '🪝', kind: 'prosthetic', price: 95, prosthetic: 'hook_arm', desc: 'Вместо руки. Оружие держит хуже.' },
  mech_arm: { name: 'Механическая рука', icon: '🦾', kind: 'prosthetic', price: 340, prosthetic: 'mech_arm', rare: true, desc: 'Почти как своя.' },
  wood_leg: { name: 'Деревянная нога', icon: '🦿', kind: 'prosthetic', price: 75, prosthetic: 'wood_leg', desc: 'Ходить можно, бегать — хуже.' },
  iron_leg: { name: 'Железная нога', icon: '🦿', kind: 'prosthetic', price: 280, prosthetic: 'iron_leg', rare: true, desc: 'Почти не хромаешь.' },
  glass_eye: { name: 'Стеклянный глаз', icon: '👁️', kind: 'prosthetic', price: 150, prosthetic: 'glass_eye', desc: 'Возвращает пол-экрана.' },
  wheelchair: { name: 'Коляска', icon: '♿', kind: 'prosthetic', price: 190, wheelchair: true, desc: 'Для безногих: ездить быстрее, чем ползать.' },
  // --- прочее ---
  herb: { name: 'Пучок трав', icon: '🌿', kind: 'misc', price: 9, desc: 'Для отваров.' },
  pelt: { name: 'Шкура', icon: '🐺', kind: 'misc', price: 14, desc: 'Товар охотника.' },
  ore: { name: 'Кусок руды', icon: '⛏️', kind: 'misc', price: 18, desc: 'Кузнецу сгодится.' },
  silver_ring: { name: 'Серебряное кольцо', icon: '💍', kind: 'misc', price: 42, desc: 'Блестит.' },
  gem: { name: 'Самоцвет', icon: '💎', kind: 'misc', price: 85, rare: true, desc: 'Дорого стоит.' },
  dark_crystal: { name: 'Тёмный кристалл', icon: '🔮', kind: 'misc', price: 110, rare: true, desc: 'Сила Дрегара.' },
  slave_papers: { name: 'Рабская грамота', icon: '📜', kind: 'misc', price: 60, desc: 'Освобождает пленника.' },
};

export const SHOP_KINDS = {
  smith: { title: 'Кузнец', stock: ['iron_sword', 'steel_sword', 'war_axe', 'spear', 'dagger', 'rusty_axe', 'hunting_bow', 'shield', 'helmet_iron', 'helmet_great', 'chain_armor', 'plate_armor', 'arrows'], buys: ['weapon', 'armor', 'misc', 'shield'], markup: 1.0 },
  fletcher: { title: 'Лучный мастер', stock: ['hunting_bow', 'elven_bow', 'war_bow', 'arrows', 'dagger', 'leather_armor', 'elven_mail'], buys: ['weapon', 'misc', 'ammo'], markup: 0.95 },
  trader: { title: 'Торговец', stock: ['bread', 'cheese', 'meat', 'apple', 'ale', 'bandage', 'torch', 'lockpick', 'rope', 'herb', 'pelt'], buys: ['misc', 'food', 'tool', 'weapon', 'armor'], markup: 1.05 },
  herbalist: { title: 'Травница', stock: ['potion_heal', 'potion_stamina', 'potion_blood', 'elixir', 'herb', 'bandage'], buys: ['misc', 'food'], markup: 1.0 },
  healer: { title: 'Лекарь', stock: ['potion_heal', 'potion_blood', 'elixir', 'bandage'], service: 'heal', buys: ['misc'], markup: 1.1 },
  prosthetic: { title: 'Костоправ', stock: ['hook_arm', 'mech_arm', 'wood_leg', 'iron_leg', 'glass_eye', 'wheelchair', 'bandage'], service: 'prosthetic', buys: ['misc'], markup: 1.15 },
  tavern: { title: 'Кабатчик', stock: ['ale', 'meat', 'bread', 'cheese'], service: 'bed', buys: ['misc', 'food'], markup: 1.1 },
  bank: { title: 'Меняла', service: 'bank', stock: [], buys: ['misc'], markup: 1 },
  trainer: { title: 'Наставник', service: 'train', stock: ['bandage', 'arrows'], buys: [], markup: 1 },
  quartermaster: { title: 'Каптенармус', stock: ['iron_sword', 'chain_armor', 'shield', 'helmet_iron', 'arrows', 'bandage', 'torch'], buys: ['weapon', 'armor', 'misc'], markup: 0.9 },
  slaver: { title: 'Работорговец', stock: ['slave_papers', 'bandage', 'rope', 'ale'], service: 'hire', buys: ['misc'], markup: 1.2 },
};

export function item(id) { return ITEMS[id] || null; }
export function itemName(id) { const i = ITEMS[id]; return i ? i.name : id; }
export function itemIcon(id) { const i = ITEMS[id]; return i ? i.icon : '❔'; }

export function initEconomy() {
  G.economy = {
    item, items: ITEMS, kinds: SHOP_KINDS,
    stockOf, priceOf, buy, sell, haggle, healService, trainService, bankDeposit, bankWithdraw, takeLoan, repayLoan,
    servicePrice, restAtBed, sellValue, state: {},
  };
  G.shopState = {};
  G.bank = { deposit: 0, loan: 0, due: 0 };
}

function stateFor(shop) {
  if (!G.shopState[shop.id]) {
    const rnd = new Rand(hash(shop.id) ^ G.seed);
    const kind = SHOP_KINDS[shop.kind] || SHOP_KINDS.trader;
    G.shopState[shop.id] = {
      stock: kind.stock.map((id) => ({ id, qty: ITEMS[id] && ITEMS[id].kind === 'ammo' ? rnd.int(20, 60) : rnd.int(1, 4) })),
      gold: 120 + rnd.int(0, 400) * (shop.zone === 2 ? 2 : 1),
      factor: 1,
      haggleUsed: false,
      restockDay: G.time.day,
    };
  }
  return G.shopState[shop.id];
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shopFactor(shop) {
  const p = G.player;
  const rep = p.rep[shop.faction] || 0;
  const trade = p.skills.trade || 0;
  const zoneBonus = shop.zone === p.zone ? -0.02 : 0.03;
  return clamp(1.18 - rep * 0.002 - trade * 0.0025 + zoneBonus, 0.72, 1.35);
}
export function stockOf(shop) {
  const st = stateFor(shop);
  if (G.time.day !== st.restockDay) {
    const kind = SHOP_KINDS[shop.kind] || SHOP_KINDS.trader;
    const rnd = new Rand(hash(shop.id) ^ (G.seed + G.time.day * 7));
    for (const s of st.stock) if (rnd.float() < 0.55) s.qty += rnd.int(1, 3);
    for (const id of kind.stock) if (!st.stock.find((x) => x.id === id) && rnd.float() < 0.4) st.stock.push({ id, qty: rnd.int(1, 3) });
    st.restockDay = G.time.day;
    st.factor = 1;
    st.haggleUsed = false;
  }
  return st;
}
export function priceOf(shop, id, selling = false) {
  const def = ITEMS[id];
  if (!def) return 0;
  const base = def.price * (SHOP_KINDS[shop.kind]?.markup || 1);
  const st = stateFor(shop);
  const f = shopFactor(shop) * st.factor;
  if (selling) {
    const p = G.player;
    const rep = p.rep[shop.faction] || 0;
    return Math.max(1, Math.round(base * (0.45 + clamp(rep, -50, 100) * 0.002) * (1 + (p.skills.trade || 0) * 0.003)));
  }
  return Math.max(1, Math.round(base * f));
}
export function sellValue(id) {
  const def = ITEMS[id];
  if (!def) return 1;
  return Math.max(1, Math.round(def.price * 0.42));
}

export function buy(shop, id, qty = 1) {
  const st = stockOf(shop);
  const entry = st.stock.find((s) => s.id === id);
  if (!entry || entry.qty <= 0) { notify('Товар кончился.', 'bad'); return false; }
  const price = priceOf(shop, id) * qty;
  const p = G.player;
  if (p.gold < price) { notify('Не хватает золота.', 'bad'); return false; }
  gainGold(-price);
  st.gold += price;
  entry.qty -= qty;
  if (entry.qty <= 0) st.stock.splice(st.stock.indexOf(entry), 1);
  addItem(id, qty);
  p.skills.trade = clamp(p.skills.trade + 0.12, 0, 100);
  G.audio.play('coin');
  emit('shop:changed', { shop });
  return true;
}
export function sell(shop, id, qty = 1) {
  const def = ITEMS[id];
  if (!def) return false;
  const st = stockOf(shop);
  const kind = SHOP_KINDS[shop.kind] || SHOP_KINDS.trader;
  const wanted = !kind.buys || kind.buys.length === 0 ? false : kind.buys.includes(def.kind);
  const price = Math.round(sellValue(id) * qty * (wanted ? 1.15 : 0.8));
  if (!removeItem(id, qty)) return false;
  gainGold(price);
  st.gold -= price;
  const ex = st.stock.find((s) => s.id === id);
  if (ex) ex.qty += qty; else st.stock.push({ id, qty });
  G.audio.play('coin');
  emit('shop:changed', { shop });
  return true;
}
export function haggle(shop) {
  const st = stateFor(shop);
  const p = G.player;
  if (st.haggleUsed) { notify('Больше не уступит сегодня.'); return false; }
  st.haggleUsed = true;
  const roll = Math.random() * 100;
  const skill = p.skills.speech + (p.rep[shop.faction] || 0) * 0.3;
  p.skills.speech = clamp(p.skills.speech + 0.3, 0, 100);
  if (roll < skill) {
    st.factor = 0.88;
    notify('Торг удался: −12% к ценам.', 'good');
    emit('shop:changed', { shop });
    return true;
  }
  st.factor = 1.04;
  notify('Купец только хмыкнул: +4% к ценам.', 'bad');
  emit('shop:changed', { shop });
  return false;
}

export function servicePrice(shop, service) {
  const p = G.player;
  const hurt = 1 + (1 - p.hp / p.hpMax) * 1.6 + p.bleeding * 0.5;
  if (service === 'heal') return Math.round(18 * hurt * (shop.zone === 2 ? 1.4 : 1));
  if (service === 'prosthetic') return 35;
  if (service === 'bed') return 6;
  if (service === 'train') return 45;
  return 10;
}
export function healService(shop) {
  const p = G.player;
  const price = servicePrice(shop, 'heal');
  if (p.gold < price) { notify('Нужно больше золота на лечение.', 'bad'); return; }
  gainGold(-price);
  p.hp = p.hpMax;
  p.bleeding = 0;
  p.blood = 100;
  for (const k of Object.keys(p.limbHp)) p.limbHp[k] = k === 'torso' ? p.hpMax : p.hpMax * 0.42;
  G.audio.play('levelup');
  notify('Тебя залатали: раны закрыты, кровь остановлена.', 'good');
  addXP(6);
  emit('player:healed', {});
}
export function trainService(shop, skill) {
  const p = G.player;
  const price = servicePrice(shop, 'train');
  if (p.gold < price) { notify('Нет золота на обучение.', 'bad'); return; }
  gainGold(-price);
  p.skills[skill] = clamp((p.skills[skill] || 0) + 3, 0, 100);
  addXP(10);
  notify(`Навык повышен: ${skillLabel(skill)} +3`, 'good');
  emit('player:skills', {});
}
export function skillLabel(k) {
  return { blade: 'владение клинком', archery: 'стрельба', block: 'блок', sneak: 'скрытность', speech: 'красноречие', athletics: 'атлетика', endurance: 'выносливость', trade: 'торговля' }[k] || k;
}
export function bankDeposit(amount) {
  const p = G.player;
  if (p.gold < amount) return;
  gainGold(-amount);
  G.bank.deposit += amount;
  notify(`Внесено ${amount} золота. Проценты капают по дням.`, 'good');
}
export function bankWithdraw(amount) {
  const p = G.player;
  const sum = Math.min(amount, G.bank.deposit);
  G.bank.deposit -= sum;
  gainGold(sum);
  notify(`Снято ${sum} золота.`);
}
export function takeLoan(amount) {
  const p = G.player;
  G.bank.loan += amount;
  G.bank.due = G.time.day + 7;
  gainGold(amount);
  notify(`Займ ${amount} золота. Вернуть до дня ${G.bank.due}.`, 'bad');
}
export function repayLoan() {
  const p = G.player;
  const sum = Math.round(G.bank.loan * 1.12);
  if (p.gold < sum) { notify(`Не хватает: нужно ${sum}.`, 'bad'); return; }
  gainGold(-sum);
  G.bank.loan = 0;
  notify('Долг закрыт.', 'good');
}
export function restAtBed(bed) {
  const p = G.player;
  const price = bed.price || 6;
  if (p.gold < price) { notify('Нет золота на ночлег.', 'bad'); return; }
  gainGold(-price);
  const hours = 8;
  G.time.seconds += hours * 3600;
  p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.7);
  p.stamina = p.staminaMax;
  p.blood = Math.min(100, p.blood + 45);
  p.bleeding = Math.max(0, p.bleeding - 1);
  p.hunger = Math.max(30, p.hunger - 12);
  emit('time:skip', { hours });
  notify(`Ты проспал ${hours} часов. Раны подзатянулись.`, 'good');
}

export function dailyInterest() {
  if (G.bank.deposit > 0) {
    const interest = Math.round(G.bank.deposit * 0.012);
    G.bank.deposit += interest;
    if (interest > 0) notify(`Банк начислил ${interest} золота процентов.`, 'good');
  }
  if (G.bank.loan > 0 && G.time.day > G.bank.due) {
    G.bank.loan = Math.round(G.bank.loan * 1.05);
    notify(`Долг просрочен и растёт: ${G.bank.loan}.`, 'bad');
  }
}
void addXP;

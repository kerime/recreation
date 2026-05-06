const ranks = ["D", "D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+"];
const attrPool = ["明るい", "冷静", "技巧派", "情熱", "観察眼", "話し上手", "度胸", "集中力", "直感", "几帳面"];
const scoutNames = ["ミナ", "レイ", "ナギ", "トワ", "シオン", "ユラ", "リコ", "アキ"];
const typeNames = ["斬", "技", "知", "速", "熱"];
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));
const round = (v) => Math.round(v);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const skills = [
  { id: "strike", name: "クイックヒット", type: "斬", mp: 6, pow: 1.05, range: "単体", desc: "安定した近接攻撃" },
  { id: "burst", name: "集中バースト", type: "技", mp: 9, pow: 1.28, range: "単体", desc: "弱点時の伸びが大きい一撃" },
  { id: "shock", name: "ジャムコール", type: "知", mp: 12, pow: 0.9, range: "全体", desc: "敵全体に小ダメージ" },
  { id: "voltage", name: "ボルテージ", type: "熱", mp: 14, vp: 100, pow: 2.05, range: "単体", desc: "VP100を使う必殺技" },
];

function makePerson(name, apl, tec, foc, attrs, portrait = Math.floor(Math.random() * 4)) {
  return { name, apl: round(apl), tec: round(tec), foc: round(foc), def: 90, attrs, status: "通常", used: false, portrait };
}

function makeMember(name, pow, tec, spd, type, portrait = 0) {
  return { name, pow, tec, spd, type, hp: 100, maxHp: 100, mp: 42, maxMp: 60, vp: 0, feeling: 1, xp: 0, pos: 0, portrait };
}

const initialState = () => {
  const types = ["ライバル", "強敵", "救出", "宝箱", "EV", "空"];
  const cells = Array.from({ length: 15 }, (_, i) => ({ type: i === 0 ? "開始" : pick(types), done: i === 0 }));
  cells[14] = { type: "CL", done: false };
  return {
    day: 1,
    money: 1200,
    tp: 3,
    rooms: 4,
    selectedPerson: 0,
    selectedMember: 0,
    selectedSkill: "strike",
    log: ["Day 1: 拠点が稼働しました。イベントで資金を作り、探索で成長素材を集めましょう。"],
    people: [
      makePerson("ミナ", 72, 42, 75, ["明るい", "直感"], 0),
      makePerson("レイ", 58, 68, 62, ["冷静", "観察眼"], 1),
      makePerson("ナギ", 82, 35, 54, ["話し上手", "情熱"], 2),
    ],
    members: [
      makeMember("クロウ", 72, 62, 55, "斬", 0),
      makeMember("キラ", 58, 79, 72, "技", 1),
      makeMember("アンナ", 66, 70, 61, "知", 2),
      makeMember("ザン", 84, 46, 50, "熱", 3),
    ],
    customers: [],
    dungeon: { pos: 0, cells },
    battle: null,
  };
};

let state = initialState();
let fxTimer = null;
let enemyTimer = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function addLog(text) {
  state.log.unshift(`Day ${state.day}: ${text}`);
  state.log = state.log.slice(0, 20);
}

function rank(v) {
  return ranks[Math.max(0, Math.min(ranks.length - 1, Math.floor(v / 10)))];
}

function render() {
  $("#day").textContent = state.day;
  $("#money").textContent = state.money;
  $("#tp").textContent = state.tp;
  $("#rooms").textContent = state.rooms;
  $("#todo").textContent = todoText();
  renderSchedule();
  renderPeople();
  renderMembers();
  renderMarket();
  renderDungeon();
  $("#log").innerHTML = state.log.map((x) => `<div>${escapeHtml(x)}</div>`).join("");
}

function todoText() {
  if (state.people.length < state.rooms) return "探索で救出マスを狙い、新しいクルーを迎えましょう。";
  if (state.money < 1800) return "イベント運営で資金を増やすと、回復と部屋拡張が楽になります。";
  if (state.members.some((m) => m.hp < 45)) return "チームを回復してから探索へ向かうのが安全です。";
  return "イベントか探索を進めて、Dayを更新しながら成長を積み上げましょう。";
}

function renderSchedule() {
  const items = [
    ["文化フェス", state.day % 5 === 0 ? "今日" : `${5 - state.day % 5}日後`],
    ["ショップ割引", state.day % 4 === 0 ? "今日" : `${4 - state.day % 4}日後`],
    ["スカウト好機", state.day % 3 === 0 ? "今日" : `${3 - state.day % 3}日後`],
    ["発表会", `${Math.max(1, 7 - state.day % 7)}日後`],
  ];
  $("#schedule").innerHTML = items.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
}

function statBlock(label, value, color = "var(--cyan)") {
  return `<div class="stat"><b>${label}</b><div>${value} / ${rank(value)}</div><div class="bar"><i style="--w:${clamp(value)}%;--c:${color}"></i></div></div>`;
}

function hpBar(value, max, color = "var(--green)") {
  const pct = max ? clamp((value / max) * 100) : 0;
  return `<div class="mini-bar"><i style="--w:${pct}%;--c:${color}"></i></div>`;
}

function renderPeople() {
  $("#peopleList").innerHTML = state.people.map((p, i) => `
    <article class="card visual-card ${i === state.selectedPerson ? "selected" : ""}" data-person="${i}">
      <div class="card-art portrait-${p.portrait}"><span>${escapeHtml(p.name)}</span></div>
      <h3>${escapeHtml(p.name)}<span>${escapeHtml(p.status)}</span></h3>
      <div class="stats">
        ${statBlock("APL", p.apl, "var(--gold)")}
        ${statBlock("TEC", p.tec, "var(--cyan)")}
        ${statBlock("FOC", p.foc, "var(--red)")}
      </div>
      <div class="stats single">${statBlock("DEF", p.def, "var(--green)")}</div>
      <div class="tags">${p.attrs.map((a) => `<span class="tag">${escapeHtml(a)}</span>`).join("")}</div>
      <div class="actions card-actions">
        <button data-train="${i}">訓練</button>
        <button data-release="${i}">休養へ</button>
      </div>
    </article>`).join("");
}

function renderMembers() {
  $("#memberList").innerHTML = state.members.map((m, i) => `
    <article class="card visual-card ${i === state.selectedMember ? "selected" : ""}" data-member="${i}">
      <div class="card-art portrait-${m.portrait}"><span>${escapeHtml(m.name)}</span></div>
      <h3>${escapeHtml(m.name)}<span>${m.type}</span></h3>
      <div class="stats">
        ${statBlock("POW", m.pow, "var(--red)")}
        ${statBlock("TEC", m.tec, "var(--cyan)")}
        ${statBlock("SPD", m.spd, "var(--blue)")}
      </div>
      <div class="stats">
        ${statBlock("HP", m.hp, "var(--green)")}
        ${statBlock("MP", m.mp, "var(--blue)")}
        ${statBlock("VP", m.vp, "var(--gold)")}
      </div>
      <div class="tags"><span class="tag">Feeling Lv.${m.feeling}</span><span class="tag">XP ${m.xp}</span></div>
    </article>`).join("");
}

function generateCustomers() {
  const bonus = state.day % 5 === 0 ? 18 : 0;
  state.customers = Array.from({ length: 4 }, (_, i) => ({
    name: `来場者 ${i + 1}`,
    heat: 35 + Math.floor(Math.random() * 55) + bonus,
    target: pick(attrPool),
    gift: pick(["APL+", "TEC+", "FOC+", "個性"]),
  }));
}

function renderMarket() {
  if (!state.customers.length) generateCustomers();
  $("#customers").innerHTML = state.customers.map((c, i) => `
    <div class="row market-row"><span class="customer-badge c${i}"></span><span>${escapeHtml(c.name)} / 好み ${escapeHtml(c.target)}</span><b>熱量 ${rank(c.heat)}</b></div>
  `).join("");
  $("#stands").innerHTML = state.people.map((p) => {
    const score = Math.round(p.apl * 0.7 + p.tec * 0.3 + (p.attrs.includes(state.customers[0]?.target) ? 18 : 0));
    return `<div class="row stand-row"><span class="mini-portrait portrait-${p.portrait}"></span><span>${escapeHtml(p.name)}</span><b>注目 ${score}</b></div>`;
  }).join("");
}

function startMarket() {
  let earned = 0;
  state.customers.forEach((c) => {
    const best = state.people
      .filter((p) => p.foc > 0)
      .map((p) => ({ p, score: p.apl + p.tec * 0.45 + (p.attrs.includes(c.target) ? 25 : 0) + Math.random() * 20 }))
      .sort((a, b) => b.score - a.score)[0]?.p;
    if (!best) return;
    const gain = Math.max(60, Math.round(c.heat * (best.tec / 18)));
    earned += gain;
    best.apl = clamp(best.apl - 5);
    best.tec = clamp(best.tec + 4);
    best.foc = clamp(best.foc - (c.gift === "FOC+" ? 12 : 6));
    best.def = clamp(best.def - 10);
    if (c.gift === "APL+") best.apl = clamp(best.apl + 4);
    if (c.gift === "TEC+") best.tec = clamp(best.tec + 4);
    if (c.gift === "個性" && best.attrs.length < 3) best.attrs.push(c.target);
    if (best.foc <= 0) best.status = "疲労";
  });
  state.money += earned;
  addLog(`イベント完了。資金 +${earned}。クルーのTECが伸び、APL/FOCを消耗しました。`);
  generateCustomers();
  render();
}

function makeEnemy(i, strong, rare) {
  const type = pick(typeNames);
  return {
    id: `e${i}`,
    name: rare ? `救出対象 ${i + 1}` : strong ? `強敵 ${i + 1}` : `ライバル ${i + 1}`,
    hp: strong ? 92 : 62,
    maxHp: strong ? 92 : 62,
    pow: strong ? 20 : 13,
    tec: strong ? 52 : 36,
    spd: strong ? 58 - i * 5 : 42 - i * 4,
    type,
    weak: pick(typeNames.filter((t) => t !== type)),
    pos: i,
  };
}

function generateDungeon() {
  const types = ["ライバル", "強敵", "救出", "宝箱", "EV", "空"];
  const cells = Array.from({ length: 15 }, (_, i) => ({ type: i === 0 ? "開始" : pick(types), done: i === 0 }));
  cells[14] = { type: "CL", done: false };
  state.dungeon = { pos: 0, cells };
  state.battle = null;
  addLog("探索マップを生成しました。隣接マスへ進み、クリアマスを目指しましょう。");
  render();
}

function renderDungeon() {
  if (!state.dungeon) generateDungeon();
  $("#map").innerHTML = state.dungeon.cells.map((c, i) => {
    const cls = ["tile", i === state.dungeon.pos ? "current" : "", c.type === "CL" ? "clear" : "", ["強敵", "救出"].includes(c.type) ? "hot" : ""].join(" ");
    const labels = { "ライバル": "敵", "強敵": "強", "救出": "救", "宝箱": "宝", "EV": "EV", "空": "空", "CL": "CL", "開始": "開始" };
    return `<button class="${cls}" data-tile="${i}" title="${c.type}">${c.done && i !== state.dungeon.pos ? "済" : labels[c.type]}</button>`;
  }).join("");
  renderBattle();
}

function isAdjacent(a, b) {
  const ax = a % 5;
  const ay = Math.floor(a / 5);
  const bx = b % 5;
  const by = Math.floor(b / 5);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

function moveTile(i) {
  if (state.battle) return addLog("バトル中は移動できません。"), render();
  if (!isAdjacent(state.dungeon.pos, i)) return addLog("移動できるのは上下左右に隣接したマスだけです。"), render();
  state.dungeon.pos = i;
  const cell = state.dungeon.cells[i];
  if (cell.done) return render();
  cell.done = true;
  if (["ライバル", "強敵", "救出"].includes(cell.type)) startBattle(cell.type);
  if (cell.type === "宝箱") {
    const gain = 250 + Math.floor(Math.random() * 300);
    state.money += gain;
    addLog(`宝箱を発見。資金 +${gain}。`);
  }
  if (cell.type === "EV") {
    addLog("イベントマス。全員のVPが少し上がりました。");
    state.members.forEach((m) => m.vp = clamp(m.vp + 12));
  }
  if (cell.type === "CL") {
    addLog("探索クリア。経験値と資金を獲得しました。");
    state.money += 800;
    state.members.forEach((m) => m.xp += 20);
  }
  render();
}

const partyFront = () => state.members.slice(0, 4);
const livingAllies = () => partyFront().filter((m) => m.hp > 0);
const livingEnemies = () => state.battle ? state.battle.enemies.filter((e) => e.hp > 0) : [];

function startBattle(kind) {
  const strong = kind === "強敵";
  const rare = kind === "救出";
  state.members.forEach((m, i) => m.pos = i);
  state.battle = {
    kind,
    enemies: Array.from({ length: 3 }, (_, i) => makeEnemy(i, strong, rare && i === 1)),
    turn: 1,
    activeSide: "ally",
    activeId: 0,
    queue: [],
    message: "行動順を計算中",
    fx: null,
  };
  rebuildQueue();
  addLog(`${kind}マス。バトル開始。`);
  render();
  if (state.battle.activeSide === "enemy") enemyTimer = window.setTimeout(enemyAction, 650);
}

function rebuildQueue() {
  if (!state.battle) return;
  const allies = partyFront().map((m, i) => ({ side: "ally", id: i, spd: m.spd, tec: m.tec, alive: m.hp > 0 }));
  const enemies = state.battle.enemies.map((e, i) => ({ side: "enemy", id: i, spd: e.spd, tec: e.tec, alive: e.hp > 0 }));
  const boost = allies.reduce((s, a) => s + a.tec, 0) - enemies.reduce((s, e) => s + e.tec, 0);
  state.battle.queue = [...allies, ...enemies]
    .filter((x) => x.alive)
    .map((x) => ({ ...x, order: x.spd + (state.battle.turn === 1 ? Math.round(boost / 18) * (x.side === "ally" ? 1 : -1) : 0) + Math.random() * 8 }))
    .sort((a, b) => b.order - a.order);
  const next = state.battle.queue[0];
  state.battle.activeSide = next?.side || "ally";
  state.battle.activeId = next?.id || 0;
  state.battle.message = boost > 45 && state.battle.turn === 1 ? "Speed Boost!" : "行動選択";
}

function activeActor() {
  if (!state.battle) return null;
  return state.battle.activeSide === "ally" ? state.members[state.battle.activeId] : state.battle.enemies[state.battle.activeId];
}

function renderBattle() {
  const el = $("#battle");
  if (!state.battle) {
    el.innerHTML = `
      <div class="battle-empty">
        <div class="reference-card"></div>
        <p>敵、強敵、救出マスに移動するとバトルが発生します。速度順に行動し、弱点とVP技で押し切りましょう。</p>
      </div>`;
    return;
  }

  const actor = activeActor();
  const skill = skills.find((s) => s.id === state.selectedSkill) || skills[0];
  const playerTurn = state.battle.activeSide === "ally";
  el.innerHTML = `
    <div class="battle-stage ${state.battle.fx ? `fx-${state.battle.fx.kind}` : ""}">
      <div class="stage-ref"></div>
      <div class="neon-grid"></div>
      <div class="turn-banner"><b>TURN ${String(state.battle.turn).padStart(2, "0")}</b><span>${escapeHtml(state.battle.message)}</span></div>
      <div class="battle-rail">
        <button id="attack" title="選択中のスキルで攻撃">攻</button>
        <button data-battle-shift title="隊列を交代">交</button>
        <button data-battle-guard title="防御してMP/VP回復">防</button>
        <button id="retreat" title="撤退">退</button>
      </div>
      <div class="party-line">${partyFront().map((m, i) => renderAllyUnit(m, i)).join("")}</div>
      <div class="enemy-line">${state.battle.enemies.map((e, i) => renderEnemyUnit(e, i)).join("")}</div>
      <div class="skill-window">
        <div class="skill-title">${escapeHtml(actor?.name || "")} ${playerTurn ? "ACTION" : "RIVAL ACTION"}</div>
        ${skills.map((s) => renderSkillButton(s, skill.id, !playerTurn)).join("")}
      </div>
      <div class="target-window">
        ${livingEnemies().map((e) => `<button data-target="${e.id}" ${!playerTurn ? "disabled" : ""}>${escapeHtml(e.name)}<span>HP ${Math.max(0, e.hp)}</span></button>`).join("")}
      </div>
      <div class="queue-strip">${state.battle.queue.map((q) => `<span class="${q.side}">${escapeHtml(q.side === "ally" ? state.members[q.id]?.name : state.battle.enemies[q.id]?.name)}</span>`).join("")}</div>
      ${state.battle.fx ? renderFx(state.battle.fx) : ""}
    </div>
    <div class="battle-caption"><b>${skill.name}</b> ${skill.desc} / ${skill.range} / ${skill.type} / MP ${skill.mp}${skill.vp ? ` / VP ${skill.vp}` : ""}</div>`;
}

function renderAllyUnit(m, i) {
  const active = state.battle.activeSide === "ally" && state.battle.activeId === i;
  const down = m.hp <= 0;
  return `
    <button class="unit ally ally-${i} ${active ? "active" : ""} ${down ? "down" : ""}" data-member="${i}" style="--i:${i}">
      <span class="nameplate">${escapeHtml(m.name)}<small>${m.type}</small></span>
      <span class="unit-face portrait-${m.portrait}"></span>
      <span class="avatar"></span>
      <span class="unit-bars">${hpBar(m.hp, m.maxHp)}${hpBar(m.mp + 40, m.maxMp + 40, "var(--blue)")}${hpBar(m.vp, 100, "var(--gold)")}</span>
    </button>`;
}

function renderEnemyUnit(e, i) {
  const active = state.battle.activeSide === "enemy" && state.battle.activeId === i;
  const down = e.hp <= 0;
  return `
    <button class="unit enemy enemy-${i} ${active ? "active" : ""} ${down ? "down" : ""}" data-enemy-unit="${e.id}" style="--i:${i}" ${down ? "disabled" : ""}>
      <span class="nameplate">${escapeHtml(e.name)}<small>弱 ${e.weak}</small></span>
      <span class="enemy-core"></span>
      <span class="avatar"></span>
      <span class="unit-bars">${hpBar(e.hp, e.maxHp, "var(--red)")}</span>
    </button>`;
}

function renderSkillButton(s, selected, disabled) {
  return `
    <button class="skill-row ${s.id === selected ? "selected" : ""}" data-battle-skill="${s.id}" ${disabled ? "disabled" : ""}>
      <span>${s.name}</span><small>${s.type} / ${s.range}</small><b>${s.vp ? "VOLT" : s.mp}</b>
    </button>`;
}

function renderFx(fx) {
  const damage = fx.damage ? `<div class="damage-number ${fx.side}">${fx.damage}</div>` : "";
  return `<div class="attack-line ${fx.side}"></div><div class="impact-ring ${fx.side}"></div>${damage}<div class="fx-text">${escapeHtml(fx.text)}</div>`;
}

function useSkill(targetId) {
  if (!state.battle || state.battle.activeSide !== "ally") return;
  const actor = activeActor();
  const skill = skills.find((s) => s.id === state.selectedSkill) || skills[0];
  const target = state.battle.enemies.find((e) => e.id === targetId) || livingEnemies()[0];
  if (!actor || !target || actor.hp <= 0) return;
  if (skill.vp && actor.vp < skill.vp) return flashMessage("VPが足りません");

  const targets = skill.range === "全体" ? livingEnemies() : [target];
  let total = 0;
  actor.mp = Math.max(-actor.maxMp, actor.mp - skill.mp);
  if (skill.vp) actor.vp = clamp(actor.vp - skill.vp);
  targets.forEach((t) => {
    const weak = skill.type === t.weak || actor.type === t.weak ? 1.35 : 1;
    const mpPenalty = actor.mp < 0 ? 0.55 : 1;
    const dmg = round((actor.pow * 0.58 + actor.tec * 0.24 + 10) * skill.pow * weak * mpPenalty);
    t.hp -= dmg;
    total += dmg;
  });
  actor.vp = clamp(actor.vp + 18);
  setFx({ kind: skill.id === "voltage" ? "voltage" : "hit", side: "ally", damage: total, text: `${actor.name} / ${skill.name}` });
  addLog(`${actor.name}の${skill.name}。合計${total}ダメージ。`);
  if (checkBattleEnd()) return;
  advanceTurn();
}

function enemyAction() {
  if (!state.battle || state.battle.activeSide !== "enemy") return;
  const enemy = activeActor();
  const targets = livingAllies();
  const target = pick(targets);
  if (!enemy || !target) return;
  const dmg = round(enemy.pow + enemy.tec * 0.18 + Math.random() * 10);
  target.hp = clamp(target.hp - dmg);
  target.vp = clamp(target.vp + 18);
  setFx({ kind: "enemy", side: "enemy", damage: dmg, text: `${enemy.name} / 反撃` });
  addLog(`${enemy.name}の攻撃。${target.name}のHP -${dmg}。`);
  if (checkBattleEnd()) return;
  advanceTurn();
}

function advanceTurn() {
  if (!state.battle) return;
  state.battle.queue.shift();
  if (!state.battle.queue.length) {
    state.battle.turn++;
    rebuildQueue();
  } else {
    const next = state.battle.queue[0];
    state.battle.activeSide = next.side;
    state.battle.activeId = next.id;
    state.battle.message = next.side === "ally" ? "行動選択" : "ライバル行動";
  }
  render();
  if (state.battle?.activeSide === "enemy") {
    window.clearTimeout(enemyTimer);
    enemyTimer = window.setTimeout(enemyAction, 650);
  }
}

function setFx(fx) {
  if (!state.battle) return;
  state.battle.fx = fx;
  render();
  window.clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => {
    if (state.battle) state.battle.fx = null;
    render();
  }, 620);
}

function flashMessage(text) {
  if (!state.battle) return;
  state.battle.message = text;
  render();
}

function checkBattleEnd() {
  if (!state.battle) return true;
  if (state.battle.enemies.every((e) => e.hp <= 0)) {
    const capture = state.battle.kind === "救出";
    const reward = 320 + state.battle.turn * 45;
    state.money += reward;
    state.members.forEach((m) => {
      m.xp += 12;
      m.vp = clamp(m.vp + 8);
    });
    if (capture && state.people.length < state.rooms) {
      const p = makePerson(pick(scoutNames), 45 + Math.random() * 35, 35 + Math.random() * 35, 45 + Math.random() * 35, [pick(attrPool)], Math.floor(Math.random() * 4));
      state.people.push(p);
      addLog(`救出成功。${p.name}がクルーに参加。資金 +${reward}。`);
    } else {
      addLog(`バトル勝利。資金 +${reward} と経験値を獲得。`);
    }
    state.battle.message = "WIN";
    window.setTimeout(() => {
      state.battle = null;
      render();
    }, 700);
    render();
    return true;
  }
  if (state.members.every((m) => m.hp <= 0)) {
    addLog("全員が行動不能。拠点で立て直してください。");
    state.battle = null;
    render();
    return true;
  }
  return false;
}

function shiftFront() {
  if (!state.battle) return;
  state.members.push(state.members.shift());
  state.members.forEach((m, i) => m.pos = i);
  rebuildQueue();
  addLog("隊列を入れ替えました。");
  render();
}

function guard() {
  if (!state.battle || state.battle.activeSide !== "ally") return;
  const actor = activeActor();
  actor.mp = clamp(actor.mp + 8, -40, actor.maxMp);
  actor.vp = clamp(actor.vp + 10);
  addLog(`${actor.name}は防御。MPとVPが少し回復。`);
  advanceTurn();
}

function nextDay() {
  state.day++;
  state.tp = 3;
  state.people.forEach((p) => {
    p.used = false;
    if (p.foc > 0 && p.status === "疲労") p.status = "通常";
  });
  state.members.forEach((m) => {
    m.hp = clamp(m.hp + 18);
    m.mp = clamp(m.mp + 12, -40, m.maxMp);
  });
  generateCustomers();
  addLog("日付が進みました。TPが回復し、チームも少し回復しました。");
  render();
}

function socialize() {
  const m = state.members[state.selectedMember] || state.members[0];
  m.feeling = clamp(m.feeling + 1, 1, 10);
  addLog(`${m.name}と交流。Feeling Lv.${m.feeling}。`);
  render();
}

function buyRoom() {
  const cost = state.day % 4 === 0 ? 650 : 900;
  if (state.money < cost) return addLog(`部屋拡張には${cost}資金が必要です。`), render();
  state.money -= cost;
  state.rooms++;
  addLog(`拠点スペースを拡張。クルー上限 ${state.rooms}。`);
  render();
}

function train(i) {
  const p = state.people[i];
  if (!p) return;
  if (state.tp <= 0) return addLog("TPが足りません。"), render();
  state.tp--;
  p.apl = clamp(p.apl + 2);
  p.tec = clamp(p.tec + 3);
  p.foc = clamp(p.foc + 3);
  p.def = clamp(p.def + 8);
  p.status = "通常";
  addLog(`${p.name}が訓練。全体的に成長しました。`);
  render();
}

function releasePerson(i) {
  const [p] = state.people.splice(i, 1);
  state.selectedPerson = Math.max(0, Math.min(state.selectedPerson, state.people.length - 1));
  addLog(`${p.name}を休養へ送りました。`);
  render();
}

function healParty() {
  const cost = state.day % 4 === 0 ? 200 : 300;
  if (state.money < cost) return addLog(`回復には${cost}資金が必要です。`), render();
  state.money -= cost;
  state.members.forEach((m) => {
    m.hp = clamp(m.hp + 45);
    m.mp = clamp(m.mp + 18, -40, m.maxMp);
  });
  addLog("チームを回復しました。");
  render();
}

function saveGame() {
  localStorage.setItem("phaseRecreationSave", JSON.stringify(state));
  addLog("ブラウザにセーブしました。");
  render();
}

function loadGame() {
  const raw = localStorage.getItem("phaseRecreationSave");
  if (!raw) return addLog("セーブデータがありません。"), render();
  try {
    state = JSON.parse(raw);
    state.members.forEach((m, i) => {
      if (!m.maxHp) m.maxHp = 100;
      if (!m.maxMp) m.maxMp = 60;
      m.pos = i;
    });
    addLog("ロードしました。");
  } catch {
    localStorage.removeItem("phaseRecreationSave");
    addLog("セーブデータが壊れていたため破棄しました。");
  }
  render();
}

function resetGame() {
  window.clearTimeout(enemyTimer);
  window.clearTimeout(fxTimer);
  state = initialState();
  render();
}

document.addEventListener("click", (e) => {
  const nav = e.target.closest(".nav");
  if (nav) {
    window.clearTimeout(enemyTimer);
    window.clearTimeout(fxTimer);
    document.querySelectorAll(".nav,.view").forEach((x) => x.classList.remove("active"));
    nav.classList.add("active");
    $(`#${nav.dataset.view}`).classList.add("active");
  }
  const skillButton = e.target.closest("[data-battle-skill]");
  if (skillButton) {
    state.selectedSkill = skillButton.dataset.battleSkill;
    render();
    return;
  }
  const targetButton = e.target.closest("[data-target]");
  if (targetButton && state.battle) return useSkill(targetButton.dataset.target);
  const enemyUnit = e.target.closest("[data-enemy-unit]");
  if (enemyUnit && state.battle) return useSkill(enemyUnit.dataset.enemyUnit);
  const person = e.target.closest("[data-person]");
  if (person) {
    state.selectedPerson = Number(person.dataset.person);
    render();
  }
  const member = e.target.closest("[data-member]");
  if (member) {
    state.selectedMember = Number(member.dataset.member);
    render();
  }
  if (e.target.id === "nextDay") nextDay();
  if (e.target.id === "socialize") socialize();
  if (e.target.id === "buyRoom") buyRoom();
  if (e.target.id === "trainSelected") train(state.selectedPerson);
  if (e.target.dataset.train !== undefined) train(Number(e.target.dataset.train));
  if (e.target.dataset.release !== undefined) releasePerson(Number(e.target.dataset.release));
  if (e.target.id === "healParty") healParty();
  if (e.target.id === "startMarket") startMarket();
  if (e.target.id === "newDungeon") generateDungeon();
  if (e.target.dataset.tile !== undefined) moveTile(Number(e.target.dataset.tile));
  if (e.target.dataset.battleShift !== undefined) shiftFront();
  if (e.target.dataset.battleGuard !== undefined) guard();
  if (e.target.id === "attack") useSkill(livingEnemies()[0]?.id);
  if (e.target.id === "retreat") {
    window.clearTimeout(enemyTimer);
    window.clearTimeout(fxTimer);
    state.battle = null;
    addLog("探索バトルから撤退しました。");
    render();
  }
  if (e.target.id === "saveGame") saveGame();
  if (e.target.id === "loadGame") loadGame();
  if (e.target.id === "resetGame") resetGame();
});

render();

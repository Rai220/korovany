'use strict';
function bovineOffice(w = game.wagon) {
  return {
    x: w.x - 0.73 * Math.cos(w.angle) + 4.05 * Math.sin(w.angle),
    z: w.z + 0.73 * Math.sin(w.angle) + 4.05 * Math.cos(w.angle),
  };
}
function cowSound(signal) {
  if (signal === 0) {
    tone(1360, 0.28, 'sine', 0.055, 1780);
  }
  if (signal === 1) {
    tone(786, 0.42, 'triangle', 0.1, 772);
    tone(1344, 0.27, 'sine', 0.039, 1311);
  }
  if (signal === 2) {
    noiseFoley(0.1, 420, 0.17);
    tone(88, 0.135, 'triangle', 0.11, 45);
  }
}
function speakCow() {
  if (game.inside) return notify('Возница остался на тракте.');
  const cow = bovineOffice(),
    d = distance(game, cow);
  if (d > 6) {
    cowSound(1);
    notify(targetBearing(cow) + ' Обоз на тракте · ' + Math.round(d) + ' м. Подойдите к колокольчику.', 4);
    return;
  }
  game.wagon.listening = 5;
  cowSound(0);
  const calls = ['Свист', 'Звон', 'Стук'],
    sequences = [
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
      [0, 1, 0],
      [2, 0, 2],
    ];
  const order = sequences[Math.floor(Math.random() * sequences.length)];
  let count = 0,
    seen = true,
    message = 'Смотри внимательно. Обозная стража подаёт три сигнала. Ответь в том же порядке.';
  let lastMessage,
    demonstration = 0;
  function playSequence(host) {
    const ticket = ++demonstration;
    const notes = [...host.querySelectorAll('[data-note]')];
    order.forEach((signal, index) => {
      setTimeout(() => {
        if (ticket !== demonstration || !host.isConnected || !$('dialog').open) return;
        for (const note of notes) note.classList.remove('sounding');
        notes[index].classList.add('sounding');
        cowSound(signal);
        setTimeout(() => notes[index].classList.remove('sounding'), 380);
      }, index * 620);
    });
  }
  function render() {
    modal(
      'Обозная стража',
      'Условный сигнал',
      '<div class="cow-office"><img src="./assets/chapter-signal.webp" alt="Возница на тракте"><div><strong>Старший обоза</strong><small>Дорожный дозор</small></div></div>' +
        '<p id="cow-message">' +
        message +
        '</p><p class="call-sequence" aria-live="polite">' +
        (seen
          ? order.map((i, index) => '<span data-note="' + index + '">' + calls[i] + '</span>').join(' · ')
          : order.map((v, i) => (i < count ? calls[v] : '◇')).join(' · ')) +
        '</p>' +
        (seen
          ? '<button id="cow-ready" class="action">Подать ответный сигнал</button><button id="signal-again" class="action quiet">Послушать сигнал</button>'
          : calls
              .map((v, i) => '<button class="cow-note action" data-call="' + i + '">' + v + '</button>')
              .join('')),
    );
    let seconds = 0;
    if (message !== lastMessage) {
      seconds = realmVoice.play('Старший обоза', message);
      lastMessage = message;
    }
    if (seen) {
      const host = $('dialog-body').querySelector('.call-sequence'),
        token = demonstration;
      setTimeout(
        () => {
          if (token === demonstration && host.isConnected && $('dialog').open) playSequence(host);
        },
        Math.max(160, seconds * 1000 + 120),
      );
      $('signal-again').onclick = () => {
        realmVoice.stop();
        playSequence(host);
      };
    }
    if (seen)
      $('cow-ready').onclick = () => {
        demonstration++;
        seen = false;
        message = 'Теперь твоя очередь.';
        render();
      };
    else
      document.querySelectorAll('[data-call]').forEach(
        (b) =>
          (b.onclick = () => {
            const value = Number(b.dataset.call);
            cowSound(value);
            if (order[count] !== value) {
              seen = true;
              count = 0;
              message = 'Погоди. Так можно поднять тревогу. Послушай ещё раз.';
              render();
              return;
            }
            if (++count < order.length) {
              render();
              return;
            }
            closeModal();
            certifyCow();
            if (!$('dialog').open) capture();
          }),
      );
  }
  render();
}
function certifyCow() {
  const g = game,
    s = g.story,
    w = g.wagon;
  if (!s.hoof) {
    s.hoof = true;
    s.entries.push([
      'Подпись возницы',
      'Старший обоза подтвердил число телег и заверил накладную. Её можно предъявить в суде.',
    ]);
  }
  w.listening = 1;
  if (s.phase === 'escort') {
    const pickets = g.actors.filter((a) => a.hp > 0 && a.tag === 'ambush');
    if (pickets.length) {
      for (const a of pickets) {
        a.team = 'neutral';
        a.tag = 'inspector';
        a.windup = 0;
      }
      speak('Начальник засады', 'Узнаю сигнал обозной стражи. Пропустите их.');
    } else speak('Возница', 'Дорога свободна. Трогаем.');
  } else if (w.cool <= 0) {
    for (const a of g.actors.filter((a) => a.hp > 0 && a.tag === 'escort')) {
      a.team = 'escort';
      a.windup = 0;
    }
    claimCargo();
    speak('Старший обоза', 'Верно. Держи накладную и расчёт за дорогу. Если спросят, я узнал твою метку.');
  } else speak('Возница', 'За нынешний рейс уже рассчитались. Следующий груз будет к вечеру.');
  checkpoint();
  drawHud();
}
function claimCargo() {
  const g = game;
  g.coins += 42;
  g.bandages++;
  g.robbed++;
  g.wagon.cool = 95;
  if (g.side === 0 && g.stage === 1) g.stage = 2;
  notify('Получено 42 монеты и бинт');
  tone(560, 0.3);
}
function stampDairy(index) {
  const site = dairies[index],
    s = game.story;
  s.dairyStamps ||= [];
  if (s.dairyStamps.includes(index)) {
    notify('В подорожной уже есть ' + site.stamp + '.');
    return;
  }
  s.dairyStamps.push(index);
  const all = s.dairyStamps.length === 4;
  game.coins += all ? 32 : 6;
  const line = all
    ? 'На подорожной все четыре печати. Казначей выписал награду. Тридцать две монеты.'
    : 'Печать «' +
      site.stamp +
      '». Вот плата за дорогу. ' +
      ['Это первая отметка.', 'Это вторая отметка.', 'Это третья отметка.'][s.dairyStamps.length - 1];
  s.entries.push([site.title, line]);
  checkpoint();
  cowSound(1);
  scene('Подорожная', site.title, 1, 'Смотритель заставы', line, [['Сложить подорожную', () => {}]]);
}

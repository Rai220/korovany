# Корованы — gpt-6.2-astra

Одиночный трёхмерный экшон от первого лица. Эльф начинает у деревянных домов лесного союза, стражник получает приказ у императорского дворца, а тёмный владыка собирает дружину у старого форта. Идентификатор модели взят из поля `turn_context.model` текущего запуска — `gpt-6.2-astra`.

## Запуск

Откройте [index.html](./index.html) в браузере с WebGL, выберите сторону и нажмите **«Начать кампанию»**. Для первого боя двигайтесь к золотому ромбу, повернитесь к противнику и наносите удары с нескольких шагов. Клавиша **M** открывает карту с положением героя, корована и цели задания.

Для локального HTTP-запуска выполните в **родительском каталоге**:

```sh
python3 -m http.server 8000
```

Откройте <http://localhost:8000/gpt-6.2-astra/>. Для GitHub Pages поместите папку `gpt-6.2-astra/` в публикуемый каталог и откройте её по адресу `https://<аккаунт>.github.io/<репозиторий>/gpt-6.2-astra/`. Сборка и установка пакетов не нужны. Все ресурсы, включая Three.js, находятся рядом с точкой входа и загружаются по относительным путям.

## Управление

| Действие | Клавиши |
| --- | --- |
| Идти вперёд, назад, вбок | W, S, A, D |
| Смотреть вокруг | Мышь после щелчка по миру |
| Идти и поворачивать без мыши | ↑ и ↓ — движение, ← и → — поворот |
| Бежать / прыгать | Shift / Пробел |
| Ударить мечом | Левая кнопка мыши или F |
| Заговорить, торговать, ограбить корован | E вблизи цели |
| Перевязать рану | H |
| Отдать приказ дружине владыки | Q |
| Открыть карту | M |
| Сохраниться | K |
| Привал, сохранение и выход | Esc |

На сенсорном экране слева появляется джойстик, справа — кнопки действий. Проведите пальцем по миру, чтобы повернуться. Кнопки «Карта» и «Меню» доступны вверху. Звук включается кнопкой с динамиком в главном меню или на привале.

## Кампании

- **Лесные эльфы.** Отразите нападение дворцового солдата и воина форта. Найдите повозку, разберитесь с охраной, заберите груз и доставьте добычу торговцу в эльфийском лесу.
- **Дворцовая стража.** Найдите командира, примите приказ, защитите ворота от шпиона и партизана. После боя отправляйтесь к горному форту и вернитесь с докладом.
- **Тёмный владыка.** Дружина умеет следовать за вами, держать позицию и идти в поход на дворец или лесное поселение. Бойцы самостоятельно обходят препятствия и сражаются с защитниками. Для завершения похода прибудьте к цели и разгромите гарнизон. Если дружина погибла, следующий приказ о походе собирает подкрепление в форте.

После выполнения задания можно продолжать исследовать мир, торговать и встречать новые набеги. Владыка может отправляться в повторные походы.

## Мир, бой и торговля

Четыре региона образуют одну непрерывную карту. На северо-западе лежат нейтральные Вольные земли, на северо-востоке — дворец, на юго-западе — эльфийский лес, на юго-востоке — Чёрные горы. Между поселениями можно ходить пешком. Нажатие на регион карты переносит героя к поселению, если рядом нет атакующего противника. Компас, стрелка и расстояние до цели помогают ориентироваться.

В лесу дальние деревья отрисованы плоскими изображениями. При приближении примерно на 39 игровых метров появляются объёмные стволы и ярусы кроны. У построек, камней и деревьев есть коллизии. Персонажи и поверженные противники остаются объёмными.

По кольцевой дороге движется конная повозка с двумя охранниками. Первое взаимодействие вызывает охрану на бой. После победы снова нажмите E у повозки, чтобы получить 42 монеты и бинт. Через 95 игровых секунд груз и охрана восстанавливаются.

Торговца легко узнать по полосатому навесу. У него можно пополнить запас бинтов, вылечиться, трижды усилить оружие, приобрести коляску или подходящий протез. Лавки есть во всех четырёх регионах.

| Травма героя | Последствие | Восстановление |
| --- | --- | --- |
| Потеря руки | Кровотечение, меч переходит в другую руку, удар слабеет | Бинт или лекарь останавливает кровь. Протез возвращает силу удара |
| Повреждение глаза | Темнеет левая половина обзора | Глазной протез восстанавливает обзор |
| Потеря ноги | Кровотечение, герой ползёт и не может прыгать | Перевязка, затем коляска для передвижения или протез для ходьбы, бега и прыжков |

Тяжёлая травма может случиться при каждом четвёртом полученном ударе, пока остаются уязвимые части тела. Один бинт останавливает кровотечение и восстанавливает до 34 единиц здоровья. Незалеченное кровотечение может привести к смерти.

## Сохранения

У каждой фракции один ручной слот в `localStorage`. Сохраняются положение и здоровье героя, травмы, покупки, стадия задания, приказ дружине, состояние воинов и корована. Чтобы продолжить, выберите ту же фракцию и нажмите **«Загрузить сохранение»**. Новая кампания занимает слот при следующем ручном сохранении. На привале и в открытых внутриигровых диалогах время останавливается.

## Проверка и ограничения

- В настольном Google Chrome проверены загрузка из подкаталога по HTTP, запуск непосредственно из файла и первый кадр WebGL. В браузерном прогоне пройдены цели трёх кампаний, проверены смена региона, движение, прыжок, бой, добыча, покупки, сохранение и восстановление после перезагрузки.
- Редкие травмы проверены в управляемых боевых состояниях. Проверены потеря обзора и подвижности, кровотечение, перевязка, покупка протезов, смерть и начало новой игры. Для воспроизводимости сценариев использовался ускоренный шаг игровой симуляции.
- Сенсорное управление проверено в эмуляции Chrome. Производительность на физических телефонах, Safari и Firefox отдельно не замерялась.
- Мир конечный, с фиксированным ландшафтом, компактными цепочками заданий и ближним боем. Торговля ведётся у прилавков. Интерьеры, мультиплеер и облачная синхронизация отсутствуют.
- Сохранения привязаны к браузеру и адресу сайта. Очистка данных сайта удаляет слоты. Для регулярной игры предпочтителен HTTP или GitHub Pages, поскольку браузеры по-разному обрабатывают хранилище локальных файлов.

## Материалы

Игровая логика, модели, растительность, окружение, интерфейс и звуковые эффекты созданы для этой игры. Для отрисовки использована локальная копия Three.js r159. [Лицензия Three.js](./vendor/three-LICENSE.txt)

Иллюстрации созданы встроенным инструментом imagegen. В игре используются три портрета ([эльф](./assets/elf.webp), [стражник](./assets/guard.webp), [владыка](./assets/lord.webp)) и четыре пейзажа ([Вольные земли](./assets/land0.webp), [дворец](./assets/land1.webp), [лес](./assets/land2.webp), [горы](./assets/land3.webp)).

<details><summary>Запросы для иллюстраций</summary>

**Лесной разведчик**

> Use case stylized-concept. Create one original premium dark fantasy woodcut / copperplate engraving book illustration. Wide horizontal 3:2 landscape plate, full bleed. Single fierce handsome androgynous forest elf ranger shown from mid-thigh upward with pale finely crosshatched face, long pointed ear, dark layered hood, quiver and arrows rising over shoulder, elegantly detailed weathered leather cloak clasp and armor, bow held across torso. Three quarter side profile looking left, figure placement centered slightly right of picture midpoint, head near upper quarter, striking readable hood silhouette, hair strands. Dense ancient fir woods around them, enormous foreground pine trunks, misty silhouetted spruce canopy and distant alpine ridges behind, some branches and silhouettes in foreground. Matte black ink shadows occupying bottom third, pewter gray, faded warm bone colored light in the fog behind the head. Finely etched silver marks, large bold dark shapes and fine engraved hatching, physical weathered printed grimoire plate, cinematic chiaroscuro. Sophisticated restrained European fantasy engraver, no color, nearly monochrome warm grey. Atmospheric, gorgeous contrast. Edge-to-edge picture, absolutely no text, letters, symbols, numbers, border, UI or panels.

**Регионы атласа**

> One wide landscape 3:2 antique copperplate engraving sheet of four medieval terrain panoramas arranged in a perfect 2 by 2 grid of equal size quadrants with no borders or gaps. Each quadrant is a complete landscape extending to its edges and will be cropped into an individual landscape card. Upper left quadrant: a peaceful medieval trade village with timber houses and winding river, upper right quadrant: distinct towering spired imperial castle with city walls on a rock, lower left quadrant: only dense ancient forest with majestic dark pine trees and mist, lower right quadrant: ruinous forbidding fortress in jagged mountains. Each zone has a unique readable skyline composition with dramatic pale overcast sky above, dark etched foreground below. Ultra detailed physical woodcut illustration, antique pen hatching, dramatic black ink shadows, weathered warm grey / bone and charcoal monochrome inks. Full bleed landscapes, no lettering no titles no dividers no frames. This is original fine landscape artwork for a dark fantasy RPG atlas.

**Стражник и владыка**

> An original black ink engraved diptych, a vertical 2:3 sheet of TWO EQUAL landscape 4:3 panels stacked one above the other, sharp division at exact center of height with zero gap/line. Each panel is a full bleed cinematic medieval character portrait in landscape composition, detailed copperplate hatching, graphite gray, faded ivory fog, deep blacks, striking dark fantasy art. UPPER HALF: heroic palace knight in intricate sallet helmet and plate armor, chain mail, sword, close-up half-body looking to the left, background misty castle gate, face lit by ivory sky. LOWER HALF: menacing dark warlord with a serrated crown-like helmet, fur mantle and etched dark armor, grim scarred face looking left, stormy high mountain stronghold and mountains in background. Place each figure right-of-center, faces about 32 percent from the top of their respective panel, rich dark lower foreground. Bold woodcut marks, no color. Absolutely no letters, words, frames, symbols, logos, numbers or UI.

</details>

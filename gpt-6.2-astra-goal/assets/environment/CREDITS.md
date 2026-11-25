# Окружение Пограничья

Материалы, панорамы и исходные трёхмерные модели предоставлены библиотекой Poly Haven под лицензией CC0 1.0. Лицензия разрешает адаптацию и распространение в составе игры. [Условия Poly Haven](https://polyhaven.com/license) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

| Первоисточник | Авторы | В игре | Лицензия |
| --- | --- | --- | --- |
| [Leafy Grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni | Луговая дернина | CC0 1.0 |
| [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) | Rob Tuytel, Rico Cilliers | Лесная почва | CC0 1.0 |
| [Forest Leaves 03](https://polyhaven.com/a/forest_leaves_03) | Rob Tuytel, Dimitrios Savva | Подстилка из опавших листьев | CC0 1.0 |
| [Rocky Trail 02](https://polyhaven.com/a/rocky_trail_02) | Amal Kumar | Укатанная земля на тракте | CC0 1.0 |
| [Stony Dirt Path](https://polyhaven.com/a/stony_dirt_path) | eye-candy.xyz | Мелкие камни и гравий в колее | CC0 1.0 |
| [Rock Pitted Mossy](https://polyhaven.com/a/rock_pitted_mossy) | Dimitrios Savva, Rico Cilliers | Горная порода и каменистый берег | CC0 1.0 |
| [Mossy Cobblestone](https://polyhaven.com/a/mossy_cobblestone) | Sơn Nguyễn | Мощение у дворца | CC0 1.0 |
| [Medieval Blocks 03](https://polyhaven.com/a/medieval_blocks_03) | Rob Tuytel | Кладка крепостей и фундаментов | CC0 1.0 |
| [Roof Slates 03](https://polyhaven.com/a/roof_slates_03) | Rob Tuytel | Сланцевые крыши | CC0 1.0 |
| [Wood Planks Grey](https://polyhaven.com/a/wood_planks_grey) | Rob Tuytel | Доски, брус и ограды | CC0 1.0 |
| [Pine Bark](https://polyhaven.com/a/pine_bark) | Dimitrios Savva | Кора на стволах | CC0 1.0 |
| [Reed Roof 03](https://polyhaven.com/a/reed_roof_03) | Rob Tuytel | Камышовая кровля | CC0 1.0 |
| [Plastered Wall 02](https://polyhaven.com/a/plastered_wall_02) | Charlotte Baglioni | Известковая штукатурка | CC0 1.0 |
| [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) | Rob Tuytel, Rico Cilliers | Зрелые хвойные деревья | CC0 1.0 |
| [Fir Sapling](https://polyhaven.com/a/fir_sapling) | Rob Tuytel, Rico Cilliers | Молодые ели | CC0 1.0 |
| [Grass Medium 01](https://polyhaven.com/a/grass_medium_01) | Rob Tuytel, Rico Cilliers | Пучки травы | CC0 1.0 |
| [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers | Папоротники | CC0 1.0 |
| [Tree Stump 02](https://polyhaven.com/a/tree_stump_02) | Rob Tuytel | Старые пни | CC0 1.0 |
| [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Kless Gyzen | Фотофактура низких речных сколов | CC0 1.0 |
| [Autumn Hill View](https://polyhaven.com/a/autumn_hill_view) | Grzegorz Wronkowski | Линия холмов и дальних лесов | CC0 1.0 |
| [Kloofendal 38d Partly Cloudy](https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky) | Greg Zaal, Jarod Guest | Облачное небо | CC0 1.0 |

## Подготовка для браузера

Почву, гравий, дернину и булыжник смешивает шейдер по расположению дороги, колеи, воды и региона. Карты нормалей передают мелкий рельеф при боковом освещении. Камень, штукатурка, древесина и кровли спроецированы в метрах. У окон, дверей, ставен и фахверковых балок собственная геометрия.

Из двух хвойных моделей подготовлены пространственные группы ветвей с прозрачностью. Вблизи ветви расположены на разной глубине вокруг объёмных стволов. Вдали дерево изображают три проекции той же модели. Трава и папоротники подготовлены похожим способом. У пней сохранена исходная развёртка. Из фактуры замшелого камня взяты фрагменты окраски для береговых наносов. Угловатые пластины сланца и линии сколов построены для игры и повторяют поверхность земли. Изображения сведены по цвету и упакованы в WebP.

Силуэт холмов и облачный небосвод соединены в круговую панораму. Игра читает материалы и геометрию из локального файла `trail-pack.js` при запуске с сайта и с диска.


### Горная порода

Верхняя половина атласа в `mountains.js` содержит цвет фотограмметрической съёмки Rock Face 03 с добавленной микротенью, нижняя — карту нормалей OpenGL. Обе карты используют один текстурный модуль GPU. Съёмку выполнил Dario Barresi, обработку — Rico Cilliers. Материал переведён в WebP и встроен для работы с локального диска. [Rock Face 03, Poly Haven](https://polyhaven.com/a/rock_face_03) · [CC0](https://polyhaven.com/license)

### Свет и звёздное небо

Для меняющегося небосвода из HDR-панорам выделены верхние полусферы. Ночные экспозиции сохраняют структуру Млечного Пути. Положение солнца и луны, цвет сумерек, осадки, ленты полярного сияния, речная дымка и свет из окон рассчитываются игрой. Панорамы загружаются из локального файла `firmament.js`.

| Экспозиция | Авторы | Права |
| --- | --- | --- |
| [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky) | Greg Zaal, Jarod Guest | [CC0](https://polyhaven.com/license) |
| [Kloofendal Overcast (Pure Sky)](https://polyhaven.com/a/kloofendal_overcast_puresky) | Greg Zaal | [CC0](https://polyhaven.com/license) |
| [Rogland Clear Night](https://polyhaven.com/a/rogland_clear_night) | Greg Zaal | [CC0](https://polyhaven.com/license) |

### Высоты альпийских водоразделов

Для `surveys.js` использована ячейка N45E007 массива Terrain Tiles. Вырезки из района Гран-Парадизо и Гриволы повёрнуты, масштабированы и совмещены с игровыми перевалами. Для дальних хребтов измерены 425 круговых сечений на расстояниях от 1,1 до 18,5 км. По каждому видимому направлению сохранены дальность, уклон и высота породы, чтобы солнце в игре освещало грани с нужной стороны. [Terrain Tiles, Mapzen](https://registry.opendata.aws/terrain-tiles/) · [Источники и условия](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)

Europe terrain data produced using Copernicus data and information funded by the European Union — EU-DEM layers. SRTM data courtesy of the U.S. Geological Survey.

### Памятное место у западной арки

Доска с выпиской, ручная тележка, флагшток и два караульных фонаря построены для игры. Письма и подписи нарисованы на холсте в браузере. Деревянные детали и ткань используют материалы из списка выше. После исхода вахты фонарь освещает дорогу из общего набора поселковых огней.

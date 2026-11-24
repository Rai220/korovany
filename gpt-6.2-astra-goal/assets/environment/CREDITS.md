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

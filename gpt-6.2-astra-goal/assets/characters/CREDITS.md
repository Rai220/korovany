# Персонажи и доспехи

## Персонажи Quaternius

Quaternius создал исходные тела, головы, причёски, костюмы, материалы и скелетные анимации. Все четыре набора опубликованы по [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

| Набор | Что вошло в игру |
| --- | --- |
| [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Мужская и женская головы с объёмными глазами и бровями, шесть вариантов причёски и бороды |
| [Modular Character Outfits – Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) | Мужские и женские комплекты Ranger и Peasant, обувь, руки, наплечник, капюшон и наручи |
| [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Ходьба, бег, прыжок, ожидание, разговор, реакция на попадание, падение, поза возницы и сидение |
| [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) | Стойка со щитом, блок, два удара мечом и тяжёлая серия |

В игре головы соединены с костюмами на общем скелете из 65 костей. Пропорции лица, цвета ткани, волосы и комплекты снаряжения зависят от персонажа. Положение суставов пересчитано под мужскую и женскую фигуры. Перчатка в виде от первого лица использует кисть и наруч егеря в позе хвата меча. Лицензии из исходных наборов лежат рядом в файлах [base-license.txt](base-license.txt), [outfits-license.txt](outfits-license.txt) и [animations-license.txt](animations-license.txt).

## Доспехи

| Предмет | Автор или коллекция | Условия и изменения |
| --- | --- | --- |
| [Breastplate from Hussar’s Cuirass, 1916.1521](https://www.clevelandart.org/art/1916.1521) | Cleveland Museum of Art, дар Джона Л. Северанса и его супруги. Аугсбург или Венгрия, около 1580 года | [Модель музея](https://sketchfab.com/3d-models/19161521-breastplate-from-hussars-cuirass-3056e857cf244a3fb651f9d07a66c5a9), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Сетка облегчена, пластины привязаны к трём костям корпуса, для имперской стражи подготовлена холодная патина |
| [Closed helmet, ZKWawel 489](https://muzea.malopolska.pl/en/objects-list/1251) | Вавельский королевский замок. Оцифровка RDW MIC, проект Małopolska’s Virtual Museums Plus | [Модель музея](https://sketchfab.com/3d-models/closed-helmet-c4bd07612f424fcd9f516cbccc2554e6), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Уменьшены сетка и карты, шлем подогнан к голове воинов Чёрных гор |
| [Medieval Sallet](https://sketchfab.com/3d-models/medieval-sallet-647a0902810d407f80717c1ccc8aab43) | Joan LP, joanlahots | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Саллет имперского патруля. Масштаб, ориентация и карты материалов адаптированы |
| [Viking Helmet](https://sketchfab.com/3d-models/viking-helmet-9a1f580d263b4c3caeb49fe6a90cc015) | ivanrighi | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Для капитана и регента сохранены купол и заклёпки. Сняты рога и их основания, добавлены варианты посадки и патины |

Копии glTF музеев и авторов получены из [Objaverse 1.0](https://huggingface.co/datasets/allenai/objaverse). Исходные glTF Standard и лицензии Quaternius доступны в [архиве моделей](https://github.com/OpenAgentsInc/openagents/tree/853417f290e7cae1df18c081b89b0818432e60af/assets/verse/characters/quaternius). Источники содержат художественные материалы. Код соединения моделей, экипировки, управления анимациями и рендера написан для этой игры.

Рисунок кольчуги у ворота сгенерирован специально для этой сборки. Шейдер кожи, ремни, клинок, форма гербового щита и его крепления изготовлены для игры. Локальная упаковка в cast-data.js хранит геометрию, уменьшенные текстуры WebP, костные веса и дорожки движений.

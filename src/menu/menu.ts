import RocketStatusController from "../controllers/RocketStatusController";
import { SavedLevel } from "../levels/levels";
import AstronautRenderUtils from "../objects/astronaut/astronautRenderUtils";
import { callTimes } from "../utils/fn";

interface MenuItem {
  label: string;
  onClick: () => void;
}

function noop() { }

type Fn = () => void;
type GoToLevelFn = (i: number) => void

export function createMenu(onResume: Fn, allLevels: number, inLevel: number, savedLevels: SavedLevel, goToLevel: GoToLevelFn) {
  const menuContainerEl = document.getElementById('mc');
  let activeMenuPageIndex = 0;
  let activeMenuElement: HTMLElement | null = null;

  function changeMenuPage(to: number) {
    if (activeMenuElement !== null) {
      activeMenuElement.remove();
    }
    activeMenuPageIndex = to;
    activeMenuElement = menuPagesElements[activeMenuPageIndex];
    menuContainerEl!.append(activeMenuElement);
  }

  function onBack() {
    changeMenuPage(0);
  }

  const handleGoToLevelAndResume = (i: number) => {
    goToLevel(i);
    onResume()
  }

  const rescued = Object.values(savedLevels).reduce((r, s) => r + s, 0)
  const totalAstronauts = allLevels * 3;

  const menu = createMenuContent(onResume, changeMenuPage, rescued, totalAstronauts);
  const objective = createObjectiveContent(onBack);
  const controls = createControlsContent(onBack)
  const levels = createLevelsContent(onBack, allLevels, inLevel, savedLevels, handleGoToLevelAndResume);
  const menuPagesElements = [menu, objective, controls, levels]; // Menu

  changeMenuPage(0);

  const backdrop = createMenuBackdrop();
  menuContainerEl?.append(backdrop)
}

export function disposeMenu() {
  const menuEl = document.getElementById('m');
  const backdropEl = document.getElementById('m-b');
  backdropEl?.remove()
  menuEl?.remove();
}

function createMenuContent(onResume: Fn, onChangePage: (i: number) => void, rescued: number, totalAstronauts: number) {
  const menu = document.createElement('div');
  menu.id = 'm';

  const items: MenuItem[] = [
    { label: 'Resume game', onClick: onResume },
    { label: 'Objective', onClick: () => onChangePage(1) },
    { label: 'Controls', onClick: () => onChangePage(2), },
    { label: 'Levels', onClick: () => onChangePage(3) },
  ]
  const title = createMenuTitle('Rescue Mission');
  const itemElements = items.map(i => createMenuButton(i.label, i.onClick));
  const totalRescuedContainer = document.createElement('div');
  const totalRescuedAstronautsLabel = document.createElement('span')
  totalRescuedAstronautsLabel.innerText = ` Rescued: ${rescued} / ${totalAstronauts}`;
  totalRescuedAstronautsLabel.className = "r"
  const astronautEl = AstronautRenderUtils.generateAstronautPixelArt();

  totalRescuedContainer.append(astronautEl)
  totalRescuedContainer.append(totalRescuedAstronautsLabel)
  menu.append(title, ...itemElements, totalRescuedContainer);
  return menu;
}

function createMenuButton(label: string, onClick: Fn): Node {
  const itemEl = document.createElement('button');
  itemEl.innerText = label;
  itemEl.className = "m-i";
  itemEl.addEventListener('click', onClick);
  return itemEl;
}

function createMenuBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.id = 'm-b';
  backdrop.className = 'f';
  return backdrop;
}

function createMenuTitle(title: string) {
  const titleEl = document.createElement('div')
  titleEl.className = "m-t";
  titleEl.innerText = title;
  return titleEl;
}

function createControlsContent(onBack: Fn) {
  const menu = document.createElement('div');
  menu.id = 'm';
  const title = createMenuTitle('Controls')
  const controls = [
    'w,a,s,d - thrusters',
    'a,d - pre launching inclination',
    'p - toggle pause',
    ` mouse wheel or '.' or ',' - zoom in/out`,
    `'space' - camera follow rocket`,
    'click & drag to move camera',
    'm - toggle menu',
    'r - restart level',
    'x - increase game speed',
    'z - decrease game speed',
  ]
  const back = createMenuButton('< Back', onBack);
  const controlEls = controls.map(createTextRow)
  const itemElements = [title, ...controlEls, back]
  menu.append(...itemElements);
  return menu;
}

export const objectiveTexts = [
  "Use your thrusters and gravity to rescue",
  "as many astronauts as you can,",
  `remember to land slowly (less than ${RocketStatusController.MAX_LANDING_SPEED} km/h) in the blue planet`
];

function createObjectiveContent(onBack: Fn) {
  const menu = document.createElement('div');
  menu.id = 'm';
  const title = createMenuTitle('Objective')

  const back = createMenuButton('< Back', onBack);
  const objective = objectiveTexts.map(createTextRow)
  const itemElements = [title, ...objective, back]
  menu.append(...itemElements);
  return menu;
}

function createTextRow(control: string) {
  const itemEl = document.createElement('div');
  itemEl.innerText = control
  itemEl.className = "c-i";
  return itemEl;
}
interface LevelOption {
  name: string;
  numOfRescues: number;
  inLevel: boolean;
  onClick: Fn
}

function createLevelsContent(onBack: Fn, numOfLevels: number, inLevel: number, savedLevels: SavedLevel, goToLevel: GoToLevelFn) {
  const menu = document.createElement('div');
  menu.id = 'm';
  const title = createMenuTitle('Levels')
  const back = createMenuButton('< Back', onBack);
  const levels: LevelOption[] = [];
  callTimes(numOfLevels, (i: number) => {
    levels.push({
      name: `Level ${i + 1}`,
      numOfRescues: savedLevels[i] || 0,
      inLevel: inLevel === i,
      onClick: () => goToLevel(i)
    });
  })
  const levelEls = levels.map(level => createLevelElement(level))

  const itemElements = [title, ...levelEls, back]

  menu.append(...itemElements);
  return menu;
}


function createLevelElement(level: LevelOption) {
  const levelItemContainer = document.createElement('div');

  const itemEl = document.createElement('button');
  itemEl.innerText = level.name;
  itemEl.className = `m-i ${level.inLevel ? "l-s" : ""} ${level.numOfRescues === 3 ? "l-a" : ""}`;
  itemEl.addEventListener('click', level.onClick);

  const astronautEls = AstronautRenderUtils.generateAstronautRescuesPixelArts(level.numOfRescues);
  astronautEls.forEach(a => {
    a.style.marginLeft = '4px';
  })
  const rescuedLabel = document.createElement('span');
  rescuedLabel.innerText = "Rescued: "
  rescuedLabel.className = "r"

  levelItemContainer.appendChild(itemEl);
  levelItemContainer.appendChild(rescuedLabel);
  levelItemContainer.append(...astronautEls);

  return levelItemContainer;
}


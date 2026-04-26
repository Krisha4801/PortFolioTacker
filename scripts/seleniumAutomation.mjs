import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const appUrl = 'http://127.0.0.1:5173/?e2e=1';
const webdriverUrl = 'http://127.0.0.1:9515';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteBinPath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const chromedriverPath = fileURLToPath(new URL('../src/chromedriver.exe', import.meta.url));

let viteProcess;
let chromeDriverProcess;
let sessionId;
let chromeUserDataDir;

const log = (message) => console.log(`[selenium] ${message}`);

const waitForHttp = async (url, timeoutMs = 30000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      await delay(500);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const webdriver = async (method, path, body) => {
  const response = await fetch(`${webdriverUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.value?.error) {
    throw new Error(payload.value?.message || `WebDriver request failed: ${method} ${path}`);
  }

  return payload.value;
};

const sessionPath = (path) => `/session/${sessionId}${path}`;

const findElement = async (using, value) => {
  const result = await webdriver('POST', sessionPath('/element'), { using, value });
  return result['element-6066-11e4-a52e-4f735466cecf'];
};

const findElements = async (using, value) => {
  const result = await webdriver('POST', sessionPath('/elements'), { using, value });
  return result.map((item) => item['element-6066-11e4-a52e-4f735466cecf']);
};

const click = async (elementId) => {
  const elementArg = { 'element-6066-11e4-a52e-4f735466cecf': elementId };
  await execute('arguments[0].scrollIntoView({ block: "center", inline: "center" });', [elementArg]);
  await delay(150);

  try {
    await webdriver('POST', sessionPath(`/element/${elementId}/click`), {});
  } catch (error) {
    if (!error.message.includes('click intercepted')) throw error;
    await execute('arguments[0].click();', [elementArg]);
  }
};

const type = async (elementId, value) => {
  await webdriver('POST', sessionPath(`/element/${elementId}/value`), { text: value });
};

const replaceText = async (elementId, value) => {
  await click(elementId);
  await type(elementId, '\uE009a\uE003');
  await delay(120);
  await type(elementId, value);
};

const execute = async (script, args = []) => {
  return webdriver('POST', sessionPath('/execute/sync'), { script, args });
};

const waitForElement = async (using, value, timeoutMs = 15000) => {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await findElement(using, value);
    } catch (error) {
      lastError = error;
      await delay(400);
    }
  }

  throw lastError || new Error(`Element not found: ${using}=${value}`);
};

const setNativeValue = async (selector, value) => {
  await execute(`
    const element = document.querySelector(arguments[0]);
    const value = arguments[1];
    const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  `, [selector, value]);
};

const setSelectByIndex = async (index, value) => {
  await execute(`
    const element = document.querySelectorAll('select')[arguments[0]];
    const value = arguments[1];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  `, [index, value]);
};

const acceptAlert = async (expectedText) => {
  const text = await webdriver('GET', sessionPath('/alert/text'));

  if (!text.includes(expectedText)) {
    throw new Error(`Expected alert containing "${expectedText}", received "${text}"`);
  }

  log(`Verified alert: ${text}`);
  await delay(1200);
  await webdriver('POST', sessionPath('/alert/accept'), {});
};

const getFormInputs = async () => {
  const inputs = await findElements('css selector', 'input');
  return {
    date: inputs[0],
    quantity: inputs[1],
    price: inputs[2]
  };
};

const fillTransaction = async ({ quantity, price, date }) => {
  const inputs = await getFormInputs();

  if (date) {
    await setNativeValue('input[type="date"]', date);
    await delay(250);
  }

  await replaceText(inputs.quantity, quantity);
  await delay(400);

  await replaceText(inputs.price, price);
  await delay(400);
};

const clickSave = async () => {
  const saveButton = await findElement('xpath', '//button[contains(., "Save Transaction")]');
  await click(saveButton);
  await delay(700);
};

const openAddTransactionForm = async () => {
  const addButton = await waitForElement('xpath', '//button[contains(., "Add Transaction")]');
  await click(addButton);
  await waitForElement('xpath', '//h3[contains(., "Add New Transaction")]');
  await delay(500);
};

const runVisibleFormTests = async () => {
  log('Opening actual Portfolio Tracker website');
  await webdriver('POST', sessionPath('/url'), { url: appUrl });
  try {
    await waitForElement('xpath', '//h1[contains(., "Selenium")]');
  } catch (error) {
    const bodyText = await execute('return document.body ? document.body.innerText : "";');
    throw new Error(`Dashboard did not load. Visible page text: ${bodyText || '[empty page]'}`);
  }
  await delay(1000);

  log('Navigating to Manage Transactions');
  const manageButton = await waitForElement('xpath', '//button[contains(., "Manage Transactions")]');
  await click(manageButton);
  await waitForElement('xpath', '//h2[contains(., "Manage Transactions")]');
  await delay(800);

  log('Selecting Stocks category and Tata Consultancy Services holding');
  await setSelectByIndex(0, 'stock');
  await delay(700);

  const holdingSelect = await waitForElement('xpath', '//select[option[contains(., "Tata Consultancy Services")]]');
  await setSelectByIndex(1, 'e2e-stock-1');
  await delay(800);

  log('AT-S01: Filling valid buy transaction and saving');
  await openAddTransactionForm();
  await fillTransaction({ quantity: '8', price: '125.50', date: '2024-04-10' });
  await clickSave();
  await acceptAlert('E2E test transaction saved successfully');

  log('AT-S02: Filling negative quantity and checking validation');
  await openAddTransactionForm();
  await fillTransaction({ quantity: '-5', price: '1500', date: '2024-04-10' });
  await clickSave();
  await acceptAlert('Quantity must be a positive number');

  log('AT-S03: Filling zero price and checking validation');
  await fillTransaction({ quantity: '10', price: '0', date: '2024-04-10' });
  await clickSave();
  await acceptAlert('Price/Amount must be a positive number');

  log('AT-S04: Filling future date and checking validation');
  await fillTransaction({ quantity: '10', price: '1200', date: '2999-01-01' });
  await clickSave();
  await acceptAlert('Transaction date cannot be in the future');

  log('Selenium automation completed: 4 visible browser tests passed');
  await delay(5000);
};

const startProcesses = async () => {
  log('Starting Vite dev server');
  viteProcess = spawn(process.execPath, [viteBinPath, '--host', '127.0.0.1', '--port', '5173'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  viteProcess.stdout.on('data', (data) => process.stdout.write(data));
  viteProcess.stderr.on('data', (data) => process.stderr.write(data));
  await waitForHttp('http://127.0.0.1:5173');

  log('Starting ChromeDriver');
  chromeDriverProcess = spawn(chromedriverPath, ['--port=9515'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  chromeDriverProcess.stdout.on('data', (data) => process.stdout.write(data));
  chromeDriverProcess.stderr.on('data', (data) => process.stderr.write(data));
  await waitForHttp(`${webdriverUrl}/status`);
};

const createSession = async () => {
  log('Launching Chrome through Selenium WebDriver');
  chromeUserDataDir = await mkdtemp(join(tmpdir(), 'portfolio-selenium-'));

  const result = await webdriver('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--start-maximized',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            `--user-data-dir=${chromeUserDataDir}`
          ]
        }
      }
    }
  });

  sessionId = result.sessionId;
};

const cleanup = async () => {
  if (sessionId) {
    await webdriver('DELETE', `/session/${sessionId}`).catch(() => {});
  }

  if (chromeDriverProcess) chromeDriverProcess.kill();
  if (viteProcess) viteProcess.kill();
  if (chromeUserDataDir) {
    await rm(chromeUserDataDir, { recursive: true, force: true }).catch(() => {});
  }
};

try {
  await startProcesses();
  await createSession();
  await runVisibleFormTests();
} catch (error) {
  console.error(`[selenium] Failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}

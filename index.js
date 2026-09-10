const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const Table = require('cli-table3');

const api = require('./api');
const { extractOtp, extractLinks, cleanText } = require('./otp');
const { copyToClipboard } = require('./clipboard');

const SESSION_FILE = path.join(__dirname, '.session.json');

function saveSession(data) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (e) {}
}

function renderHeader(address) {
  console.clear();
  console.log(
    boxen(
      chalk.bold.cyan('GmailBurner CLI') + '\n' +
      chalk.gray('Real-time Disposable Inbox & OTP Extractor v1.0.0'),
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center',
      }
    )
  );

  if (address) {
    console.log(
      boxen(
        chalk.gray('Active Address:\n') +
        chalk.bold.yellow(address) + '\n\n' +
        chalk.green('[COPIED] Address copied to clipboard. Ready to use.'),
        {
          padding: 1,
          margin: { top: 0, bottom: 1, left: 0, right: 0 },
          borderStyle: 'single',
          borderColor: 'green',
        }
      )
    );
  }
}

async function listenLoop(session) {
  renderHeader(session.address);

  const seenMessageIds = new Set();
  const spinner = ora({
    text: chalk.white('Listening for incoming messages... ') + chalk.gray('(2.5s polling)'),
    spinner: 'dots',
  }).start();

  try {
    const existing = await api.getMessages(session.token);
    for (const msg of existing) {
      seenMessageIds.add(msg.id);
    }
    if (existing.length > 0) {
      spinner.info(chalk.gray(`Found ${existing.length} existing message(s) in inbox.`));
      spinner.start();
    }
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('expired')) {
      spinner.fail(chalk.red('Session expired. Generating fresh inbox...'));
      clearSession();
      return runNewInbox();
    }
  }

  let running = true;
  process.on('SIGINT', () => {
    running = false;
    spinner.stop();
    console.log('\n' + chalk.yellow('Listener stopped. Session saved.'));
    process.exit(0);
  });

  while (running) {
    try {
      const messages = await api.getMessages(session.token);

      for (const summary of messages) {
        if (!seenMessageIds.has(summary.id)) {
          seenMessageIds.add(summary.id);
          spinner.stop();

          process.stdout.write('\u0007');

          const detail = await api.getMessage(session.token, summary.id);
          const fromAddr = detail.from?.address || summary.from?.address || 'Unknown';
          const fromName = detail.from?.name || '';
          const subject = detail.subject || '(No Subject)';
          const textBody = detail.text || cleanText(detail.html || '');
          const htmlBody = detail.html || '';

          const otpResult = extractOtp(subject, textBody);
          const linkResult = extractLinks(htmlBody, textBody);

          let otpBadge = '';
          if (otpResult.code) {
            await copyToClipboard(otpResult.code);
            otpBadge = '\n\n' + boxen(
              chalk.bold.green('VERIFICATION CODE DETECTED') + '\n\n' +
              chalk.bold.bgGreen.black(`  ${otpResult.code}  `) + '\n\n' +
              chalk.cyan('[COPIED] Code copied to clipboard.'),
              {
                padding: 1,
                borderStyle: 'double',
                borderColor: 'green',
                align: 'center',
              }
            );
          }

          let linkDisplay = '';
          if (linkResult.verificationLinks.length > 0) {
            linkDisplay = '\n\n' + chalk.bold.cyan('Verification Links:') + '\n' +
              linkResult.verificationLinks.slice(0, 3).map(l => chalk.underline.blue(l)).join('\n');
          }

          const messageCard =
            chalk.bold.white('From: ') + chalk.yellow(`${fromName ? fromName + ' <' + fromAddr + '>' : fromAddr}`) + '\n' +
            chalk.bold.white('Subject: ') + chalk.cyan(subject) + '\n' +
            chalk.bold.white('Received: ') + chalk.gray(new Date(detail.createdAt || Date.now()).toLocaleTimeString()) +
            otpBadge +
            linkDisplay + '\n\n' +
            chalk.bold.white('Preview:\n') +
            chalk.gray(textBody.slice(0, 280) + (textBody.length > 280 ? '...' : ''));

          console.log('\n' + boxen(messageCard, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: otpResult.code ? 'green' : 'blue',
          }));

          spinner.start(chalk.white('Listening for next incoming message...'));
        }
      }
    } catch (err) {
      if (err.message.includes('401')) {
        spinner.fail(chalk.red('Authentication token expired.'));
        clearSession();
        return runNewInbox();
      }
    }

    await new Promise(r => setTimeout(r, 2500));
  }
}

async function runNewInbox(preferredUsername = null) {
  const spinner = ora(chalk.white('Provisioning inbox...')).start();
  try {
    const account = await api.createRandomAccount(preferredUsername);
    saveSession(account);
    await copyToClipboard(account.address);
    spinner.succeed(chalk.green('Inbox ready.'));
    await listenLoop(account);
  } catch (err) {
    spinner.fail(chalk.red(`Failed to provision inbox: ${err.message}`));
    process.exit(1);
  }
}

async function listMessages() {
  const session = loadSession();
  if (!session) {
    console.log(chalk.red('No active session found. Run "node index.js new" to create one.'));
    return;
  }

  const spinner = ora(chalk.white('Fetching inbox messages...')).start();
  try {
    const messages = await api.getMessages(session.token);
    spinner.stop();

    if (messages.length === 0) {
      console.log(chalk.yellow(`Inbox for ${session.address} is empty.`));
      return;
    }

    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('From'), chalk.cyan('Subject'), chalk.cyan('Time')],
      style: { head: [], border: ['gray'] },
    });

    for (const msg of messages) {
      const from = msg.from?.address || 'Unknown';
      const time = new Date(msg.createdAt).toLocaleTimeString();
      table.push([msg.id.slice(0, 8), from, msg.subject || '(None)', time]);
    }

    console.log('\n' + chalk.bold.white(`Messages for ${session.address}:`));
    console.log(table.toString() + '\n');
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
  }
}

async function readMessage(messageId) {
  const session = loadSession();
  if (!session) {
    console.log(chalk.red('No active session found. Run "node index.js new" to create one.'));
    return;
  }

  const spinner = ora(chalk.white('Fetching message details...')).start();
  try {
    const messages = await api.getMessages(session.token);
    const target = messages.find(m => m.id.startsWith(messageId));

    if (!target) {
      spinner.fail(chalk.red(`Message with ID "${messageId}" not found in active inbox.`));
      return;
    }

    const detail = await api.getMessage(session.token, target.id);
    spinner.stop();

    const text = detail.text || cleanText(detail.html || '');
    const otp = extractOtp(detail.subject, text);
    const links = extractLinks(detail.html, detail.text);

    console.log('\n' + boxen(
      chalk.bold.white('From: ') + chalk.yellow(`${detail.from?.name || ''} <${detail.from?.address}>`) + '\n' +
      chalk.bold.white('To: ') + chalk.gray(detail.to?.[0]?.address || session.address) + '\n' +
      chalk.bold.white('Subject: ') + chalk.cyan(detail.subject || '') + '\n' +
      chalk.bold.white('Date: ') + chalk.gray(new Date(detail.createdAt).toLocaleString()),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
    ));

    if (otp.code) {
      await copyToClipboard(otp.code);
      console.log(boxen(
        chalk.bold.green('VERIFICATION CODE: ') + chalk.bold.bgGreen.black(`  ${otp.code}  `) + '\n' +
        chalk.cyan('[COPIED] Code copied to clipboard.'),
        { padding: 1, borderStyle: 'double', borderColor: 'green' }
      ));
    }

    if (links.verificationLinks.length > 0) {
      console.log('\n' + chalk.bold.cyan('Action / Verification Links:'));
      links.verificationLinks.forEach(l => console.log('  ' + chalk.underline.blue(l)));
    }

    console.log('\n' + chalk.bold.white('Message Content:') + '\n');
    console.log(chalk.white(text));
    console.log('\n');
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'auto';

  if (cmd === 'new') {
    const customUser = args[1] || null;
    clearSession();
    return await runNewInbox(customUser);
  }

  if (cmd === 'list') {
    return await listMessages();
  }

  if (cmd === 'read') {
    if (!args[1]) {
      console.log(chalk.red('Usage: node index.js read <id>'));
      process.exit(1);
    }
    return await readMessage(args[1]);
  }

  if (cmd === 'copy') {
    const session = loadSession();
    if (!session) {
      console.log(chalk.red('No active session. Run "node index.js new" first.'));
      return;
    }
    await copyToClipboard(session.address);
    console.log(chalk.green(`[COPIED] Address copied: ${session.address}`));
    return;
  }

  if (cmd === 'clear') {
    clearSession();
    console.log(chalk.yellow('Active session cleared.'));
    return;
  }

  const existingSession = loadSession();
  if (existingSession && existingSession.address && existingSession.token) {
    return await listenLoop(existingSession);
  }

  return await runNewInbox();
}

main().catch(err => {
  console.error(chalk.red('Unexpected error:'), err);
  process.exit(1);
});

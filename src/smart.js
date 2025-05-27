const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const chalk = require('chalk');
const PDFDocument = require('pdfkit');
const smartctlPath = path.resolve(__dirname, 'smartctl.exe');
const readline = require('readline');

console.clear();

console.log(`
${chalk.cyan.bold('=====================================================================================')}
${chalk.cyan.bold('#                   SMARTYHDD - Disk Diagnostic Tool V0.1.0                         #')}
${chalk.cyan.bold('=====================================================================================')}
`);

console.log(`${chalk.white('An open-source diagnostic and formatting tool for HDDs & SSDs')}`);
console.log(`${chalk.white('GitHub:')} ${chalk.underline.blue('https://github.com/pupariaa/smartyhdd')}`);
console.log(`${chalk.gray('Developed by Puparia - Running on Node.js')}`);
console.log(`${chalk.white('V0.1.0')}`);
console.log(`
${chalk.green('Starting up... please wait.')}
`);

function getScanResults() {
    try {
        const result = execFileSync(smartctlPath, ['--scan-open'], { encoding: 'utf8' });
        return result
            .split('\n')
            .filter(line => line.includes('-d'))
            .map(line => {
                const [device, , type] = line.trim().split(/\s+/);
                return { device, type: type.replace('-d', '').trim() };
            });
    } catch (err) {
        console.error('[ERROR SCAN]', err.message);
        return [];
    }
}

function trySmartctl(device, type) {
    try {
        const result = execFileSync(smartctlPath, ['-a', device, '-d', type, '--json=c'], { encoding: 'utf8' });
        return { device, type, json: JSON.parse(result) };
    } catch {
        return null;
    }
}

function normalizeDevicePath(device) {
    const match = device.match(/\/dev\/sd([a-z])/i);
    if (!match) return device;
    const index = match[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    return `\\.\\PhysicalDrive${index}`;
}

function formatLabel(entry) {
    const j = entry.json;
    const name = j.model_name || 'Unknown';
    const serial = j.serial_number || 'N/A';
    const size = j.user_capacity?.bytes ? (j.user_capacity.bytes / 1e9).toFixed(1) + ' GB' : 'Unknown';
    return `${name} (${size}) — SN: ${serial}`;
}

function formatPreview(j) {
    const name = j.model_name || 'Unknown';
    const temp = j.temperature?.current ?? 'N/A';
    const status = j.smart_status?.passed ? chalk.green('PASSED') : chalk.red('FAILED');
    const wear = j.endurance_used?.current_percent ?? j.nvme_smart_health_information_log?.percentage_used ?? '?';
    const powerOn = j.power_on_time?.hours ?? j.nvme_smart_health_information_log?.power_on_hours ?? '?';

    return `
${chalk.cyan.bold(name)}
Temp:      ${temp} °C
SMART:     ${status}
Wear:      ${wear}% used
Power On:  ${powerOn}h
`;
}

async function formatDrive(device) {
    device = normalizeDevicePath(device);
    const match = device.match(/PhysicalDrive(\d+)/i);
    if (!match) {
        console.log("[ERROR] Could not resolve disk index.");
        return;
    }

    const diskIndex = match[1];

    const { fsType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'fsType',
            message: `Select file system for disk ${diskIndex}:`,
            choices: ['NTFS', 'FAT32', 'exFAT', 'Back']
        }
    ]);
    if (fsType === 'Back') return;

    const { method } = await inquirer.prompt([
        {
            type: 'list',
            name: 'method',
            message: `Select format method:`,
            choices: ['Quick Format', 'Full Format', 'Back']
        }
    ]);
    if (method === 'Back') return;

    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `⚠️ ALL DATA ON DISK ${diskIndex} WILL BE LOST. Continue?`,
            default: false
        }
    ]);
    if (!confirm) return;

    const label = `DISK_${Date.now()}`;
    const quick = method === 'Quick Format' ? 'quick' : '';

    const scriptContent = `
select disk ${diskIndex}
clean
create partition primary
format fs=${fsType.toLowerCase()} label="${label}" ${quick}
assign
exit
`.trim();

    const tempFile = path.join(__dirname, `format_disk_${diskIndex}.txt`);
    fs.writeFileSync(tempFile, scriptContent);

    try {
        execSync(`diskpart /s "${tempFile}"`, { stdio: 'inherit' });
        console.log(chalk.green(`\n✔ Disk ${diskIndex} formatted successfully as ${fsType}`));
    } catch (err) {
        console.error(chalk.red(`[ERROR] Format failed:\n${err.message}`));
    } finally {
        fs.unlinkSync(tempFile);
    }
}

async function driveMenu(entry) {
    const device = entry.device;
    while (true) {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `Actions for ${device}:`,
                choices: ['Format', 'Export SMART PDF', 'Back']
            }
        ]);

        if (action === 'Format') {
            await formatDrive(device);

        } else if (action === 'Export SMART PDF') {
            const { language } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'language',
                    message: 'Select report language:',
                    choices: ['English', 'Français']
                }
            ]);
            const success = await exportPdfReport(entry, language);
            if (success) {
                console.log(`[SUCCESS] PDF exported for ${language}`);
            }
        } else if (action === 'Back') {
            break;
        }
    }
}

async function exportPdfReport(entry, language = 'English') {
    const j = entry.json;
    const isFR = language === 'Français';

    const T = {
        title: isFR ? 'Rapport de Diagnostic SMART' : 'SMART Diagnostic Report',
        summary: isFR ? 'Résumé' : 'Summary',
        advAttr: isFR ? 'Attributs SMART Avancés' : 'Advanced SMART Attributes',
        labels: {
            Model: isFR ? 'Modèle' : 'Model',
            Serial: isFR ? 'Numéro de série' : 'Serial',
            Firmware: 'Firmware',
            Capacity: isFR ? 'Capacité' : 'Capacity',
            Temperature: isFR ? 'Température' : 'Temperature',
            Power: isFR ? 'Heures d\'utilisation' : 'Power-On Hours',
            Health: isFR ? 'État de santé' : 'Health',
            Endurance: isFR ? 'Usure' : 'Endurance Used'
        },
        healthPassed: isFR ? 'BON' : 'PASSED',
        healthFailed: isFR ? 'MAUVAIS' : 'FAILED',
        footer: isFR ? 'Rapport généré par smartHDD' : 'Report generated by smartHDD'
    };

    const friendlyAttrName = name => {
        const map = {
            'Raw_Read_Error_Rate': isFR ? 'Taux d’erreurs de lecture' : 'Raw Read Error Rate',
            'Reallocated_Sector_Ct': isFR ? 'Secteurs réalloués' : 'Reallocated Sector Count',
            'Power_On_Hours': isFR ? 'Heures d’utilisation' : 'Power-On Hours',
            'Power_Cycle_Count': isFR ? 'Nombre de cycles' : 'Power Cycle Count',
            'Temperature_Celsius': isFR ? 'Température (°C)' : 'Temperature (°C)',
            'SSD_Life_Left': isFR ? 'Durée de vie SSD restante' : 'SSD Life Left',
            'Wear_Leveling_Count': isFR ? 'Usure moyenne' : 'Wear Leveling Count'
        };
        return map[name] || name.replace(/_/g, ' ');
    };

    const outputPath = path.join(__dirname, `smart_${(j.serial_number || 'unknown')}_report.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fillColor('#1a73e8').fontSize(22).text(T.title, { align: 'center' });
    doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).stroke('#1a73e8');
    doc.moveDown(1.5);

    doc.fontSize(13).fillColor('#333').text(T.summary, { underline: true }).moveDown(0.5);
    const infos = [
        [T.labels.Model, j.model_name || 'Unknown'],
        [T.labels.Serial, j.serial_number || 'Unknown'],
        [T.labels.Firmware, j.firmware_version || 'Unknown'],
        [T.labels.Capacity, j.user_capacity?.bytes ? (j.user_capacity.bytes / 1e9).toFixed(1) + ' GB' : 'Unknown'],
        [T.labels.Temperature, `${j.temperature?.current ?? 'N/A'} °C`],
        [T.labels.Power, j.power_on_time?.hours ?? j.nvme_smart_health_information_log?.power_on_hours ?? 'N/A'],
        [T.labels.Health, j.smart_status?.passed ? T.healthPassed : T.healthFailed],
        [T.labels.Endurance, (j.endurance_used?.current_percent ?? j.nvme_smart_health_information_log?.percentage_used ?? '?') + '%']
    ];

    doc.fontSize(11);
    infos.forEach(([label, value]) => {
        doc.fillColor('#444').text(label + ':', { continued: true });
        doc.fillColor('black').text(' ' + value);
    });

    doc.moveDown(1);

    doc.fontSize(13).fillColor('#333').text(T.advAttr, { underline: true }).moveDown(0.5);
    const headers = ['ID', isFR ? 'Nom' : 'Name', 'Val', 'Worst', 'Thresh', isFR ? 'Brut' : 'Raw'];
    const colWidths = [30, 150, 45, 45, 45, 160];
    const tableYStart = doc.y;

    doc.fontSize(10).fillColor('white').fill('#1a73e8');
    headers.forEach((h, i) => {
        const x = 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.rect(x, tableYStart, colWidths[i], 20).fill();
        doc.fillColor('white').text(h, x + 4, tableYStart + 5, { width: colWidths[i] - 8 });
    });
    doc.y = tableYStart + 20;

    const attributes = j.ata_smart_attributes?.table || [];
    attributes.slice(0, 20).forEach((attr, idx) => {
        const y = doc.y;
        const bg = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
        doc.fillColor(bg).rect(40, y, colWidths.reduce((a, b) => a + b, 0), 18).fill();

        const row = [
            attr.id,
            friendlyAttrName(attr.name),
            attr.value,
            attr.worst,
            attr.thresh,
            attr.raw?.string || attr.raw?.value || 'N/A'
        ];

        doc.fillColor('#111').fontSize(9);
        row.forEach((val, i) => {
            const x = 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.text(String(val), x + 4, y + 4, { width: colWidths[i] - 8 });
        });

        doc.y = y + 18;
    });

    doc.moveDown(1.2).fontSize(9).fillColor('#888');
    doc.text(`${T.footer} - ${new Date().toLocaleString()}`, { align: 'right' });
    doc.text('Version 1.0.1A', { align: 'right' });

    doc.end();
    await new Promise(resolve => stream.on('finish', resolve));
    console.log(`\n📄 PDF exported to:\n${chalk.green(outputPath)}`);
    return true;
}

async function run() {
    const devices = getScanResults();
    const results = devices.map(d => trySmartctl(d.device, d.type)).filter(Boolean);

    if (results.length === 0) {
        console.log("No SMART-enabled disks found.");
        process.exit(0);
    }

    while (true) {
        const choices = results.map((entry, index) => ({
            name: formatLabel(entry),
            value: index,
            short: entry.device
        }));

        choices.push(new inquirer.Separator());
        choices.push({ name: chalk.red('[Quit]'), value: 'quit' });

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'disk',
                message: 'Select a disk:',
                choices,
                pageSize: 10
            }
        ]);

        if (answer.disk === 'quit') break;

        const selected = results[answer.disk];
        const shortName = selected.device.replace(/[\\\\/.]/g, '_');
        const outPath = path.join(__dirname, `smart_${shortName}_selected.json`);
        fs.writeFileSync(outPath, JSON.stringify(selected.json, null, 2));
        console.log(formatPreview(selected.json));

        await driveMenu(selected);
    }

    console.log('\nPress any key to exit...');
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => process.exit(0));
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('', () => {
            rl.close();
            process.exit(0);
        });
    }
}

run();
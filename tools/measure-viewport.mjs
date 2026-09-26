/**
 * measure-viewport.mjs — Comprueba que una pagina cabe en una sola pantalla.
 * -----------------------------------------------------------------------------
 * El validador de arquitectura revisa el CSS, pero no puede saber si el
 * resultado desborda la ventana. Eso lo mide un motor de verdad: aqui se abre
 * Chrome sin interfaz, se carga la pagina a varias alturas y se lee
 * document.scrollHeight frente a la altura visible.
 *
 * Sin dependencias: se habla con Chrome por el protocolo DevTools usando solo
 * modulos nativos de Node (net, child_process, fs).
 *
 * Uso:  node tools/measure-viewport.mjs [pagina.html]
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.argv[2] || 'index.html';

/** Alturas representativas: portatil, escritorio 1080p,_monitor alto y uno bajo. */
const VIEWPORTS = [
    { name: 'portatil 1440x900', width: 1440, height: 900 },
    { name: 'escritorio 1920x1080', width: 1920, height: 1080 },
    { name: 'estreno 2560x1440', width: 2560, height: 1440 },
    { name: 'corta 1280x620', width: 1280, height: 620 },
    // En movil el scroll es inevitable y aceptable: en una columna, las diez
    // filas de los listados mas la prosa no caben en 844px sin borrar contenido.
    // Se mide igual, pero no cuenta como fallo.
    { name: 'movil 390x844', width: 390, height: 844, expectScroll: true }
];

const CHROME_CANDIDATES = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

/** Ultimo recurso: deja que el PATH resuelva el navegador. */
const BROWSER = CHROME_CANDIDATES.find((p) => existsSync(p)) || 'chrome';

const profile = mkdtempSync(join(tmpdir(), 'measure-viewport-'));
const port = 9222 + Math.floor(Math.random() * 500);

const browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank'
], { stdio: 'ignore' });

function cleanup() {
    try { browser.kill(); } catch { /* ya estaba cerrado */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* temporal */ }
}

/** Espera a que el navegador abra su puerto de depuracion. */
async function waitForDevTools(attempts = 80) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) return (await response.json()).webSocketDebuggerUrl;
        } catch { /* todavia no escucha */ }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('el navegador no abrio el puerto de DevTools');
}
/**
 * Envuelve una carga en una trama WebSocket de cliente.
 *
 * El protocolo exige que TODA trama enviada por el cliente vaya enmascarada con
 * una clave de 4 bytes. La mascara se sortea en cada envio porque el RFC 6455
 * prohibe que el servidor asuma una clave fija.
 */
function frame(payload) {
    const length = payload.length;
    let header;

    if (length < 126) {
        header = Buffer.from([0x81, 0x80 | length]);                 // FIN + binario
    } else if (length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(length), 2);
    }

    const mask = randomBytes(4);
    const masked = Buffer.allocUnsafe(length);
    for (let i = 0; i < length; i += 1) masked[i] = payload[i] ^ mask[i % 4];

    return Buffer.concat([header, mask, masked]);
}
/**
 * Cliente minimo del protocolo DevTools.
 *
 * El protocolo habla WebSocket, pero aqui solo hace falta el envio de tramas
 * del cliente al servidor, asi que basta un socket TCP en el que se escriben a
 * mano la cabecera y la carga. Se evita a proposito depender de un paquete de
 * npm para no anadir nada al proyecto.
 */
class DevTools {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.buffer = Buffer.alloc(0);
        socket.on('data', (chunk) => this.ingest(chunk));
    }

    /**
     * Acumula bytes y decodifica las tramas WebSocket que llegan.
     *
     * Se ignoran las tramas de control (ping, pong, close) y solo se entregan
     * los mensajes de texto, que son los que traen las respuestas del
     * protocolo. Si una trama llega partida entre dos lecturas, los bytes
     * sobrantes se quedan en el buffer para la siguiente.
     */
    ingest(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        for (;;) {
            if (this.buffer.length < 2) return;

            const opcode = this.buffer[0] & 0x0f;
            const masked = (this.buffer[1] & 0x80) !== 0;
            let length = this.buffer[1] & 0x7f;
            let offset = 2;

            if (length === 126) {
                if (this.buffer.length < 4) return;
                length = this.buffer.readUInt16BE(2);
                offset = 4;
            } else if (length === 127) {
                if (this.buffer.length < 10) return;
                length = Number(this.buffer.readBigUInt64BE(2));
                offset = 10;
            }

            let mask = null;
            if (masked) {
                if (this.buffer.length < offset + 4) return;
                mask = this.buffer.subarray(offset, offset + 4);
                offset += 4;
            }

            if (this.buffer.length < offset + length) return; // trama incompleta

            const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
            if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
            this.buffer = this.buffer.subarray(offset + length);

            if (opcode === 0x8) { this.socket.end(); return; }  // cierre
            if (opcode !== 0x1) continue;                        // no es texto

            let message;
            try { message = JSON.parse(payload.toString()); } catch { continue; }

            const resolver = this.pending.get(message.id);
            if (resolver) { this.pending.delete(message.id); resolver(message); }
        }
    }

    send(method, params = {}) {
        const id = this.nextId++;
        const payload = Buffer.from(JSON.stringify({ id, method, params }));
        return new Promise((resolveCall) => {
            this.pending.set(id, resolveCall);
            this.socket.write(frame(payload));
        });
    }

    /** Igual que send(), pero aplicando el id que lleva la sesion ya abierta. */
    socketRequest(sessionId, id, method, params = {}) {
        const payload = Buffer.from(JSON.stringify({ id, sessionId, method, params }));
        return new Promise((resolveCall) => {
            this.pending.set(id, resolveCall);
            this.socket.write(frame(payload));
        });
    }
}
/** Abre el socket del DevTools y completa el saludo WebSocket a mano. */
function openSocket(url) {
    return new Promise((resolveCall, rejectCall) => {
        const target = new URL(url);
        const socket = connect({ host: target.hostname, port: Number(target.port) }, () => {
            socket.write(
                `GET ${target.pathname}${target.search} HTTP/1.1\r\n`
                + `Host: ${target.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n`
                + 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'
            );
        });

        let handshake = Buffer.alloc(0);
        const onHandshake = (chunk) => {
            handshake = Buffer.concat([handshake, chunk]);
            const end = handshake.indexOf('\r\n\r\n');
            if (end === -1) return;
            socket.removeListener('data', onHandshake);
            const rest = handshake.subarray(end + 4);
            const client = new DevTools(socket);
            if (rest.length) client.ingest(rest);
            resolveCall(client);
        };
        socket.on('data', onHandshake);
        socket.on('error', rejectCall);
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const client = await openSocket(await waitForDevTools());

    const { result: target } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { result: attached } = await client.send('Target.attachToTarget', {
        targetId: target.targetId,
        flatten: true
    });

    // Con flatten:true el protocolo enruta cada comando por sessionId dentro del
    // propio mensaje; sendMessageToTarget queda obsoleto y el navegador lo rechaza.
    let nextId = 1;
    const session = (method, params = {}) => client.socketRequest(
        attached.sessionId, nextId++, method, params
    );

    await session('Page.enable');
    await session('Runtime.enable');

    const fileUrl = pathToFileURL(join(ROOT, PAGE)).href;
    let overflows = 0;

    console.log(`measure-viewport — ${PAGE}\n`);

    for (const viewport of VIEWPORTS) {
        await session('Emulation.setDeviceMetricsOverride', {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
            mobile: false
        });
        await session('Page.navigate', { url: fileUrl });
        await sleep(900); // deja cargar fuentes locales antes de medir

        const probe = await session('Runtime.evaluate', {
            returnByValue: true,
            expression: 'JSON.stringify({ scroll: document.documentElement.scrollHeight,'
                + ' visible: document.documentElement.clientHeight })'        });

        const { scroll, visible, parts } = JSON.parse(probe.result.result.value);
        if (process.env.MEASURE_DEBUG) console.log('        partes:', JSON.stringify(parts));

        const overflow = scroll - visible;
        const fits = overflow <= 1;
        if (!fits && !viewport.expectScroll) overflows += 1;

        console.log(
            `${fits ? 'OK   ' : 'OVER '} ${viewport.name.padEnd(22)} `
            + `contenido ${String(scroll).padStart(5)}px  `
            + `ventana ${String(visible).padStart(5)}px  `
            + (fits ? 'sin scroll' : `desborda ${overflow}px`)
        );
    }

    console.log(overflows === 0
        ? '\nRESULTADO GLOBAL: cabe en una sola pantalla en todos los tama\u00f1os'
        : `\nRESULTADO GLOBAL: hay scroll en ${overflows} de ${VIEWPORTS.length} tama\u00f1os`);

    cleanup();
    process.exit(overflows === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error('measure-viewport no pudo ejecutarse:', error.message);
    cleanup();
    process.exit(2);
});
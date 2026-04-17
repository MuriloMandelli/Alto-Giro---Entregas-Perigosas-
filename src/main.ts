import * as Phaser from 'phaser';
import * as planck from 'planck';

// ==========================================
// 💥 TRAVA DE TELA CHEIA 💥
// ==========================================
const style = document.createElement('style');
style.innerHTML = `
  * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
  html, body, #app { width: 100vw !important; height: 100vh !important; max-width: none !important; overflow: hidden !important; background-color: #000 !important; display: block !important; }
  canvas { display: block !important; width: 100vw !important; height: 100vh !important; }
`;
document.head.appendChild(style);

const P2M = 1 / 30; 
const M2P = 30;

// ==========================================
// 🎵 SINTETIZADOR DE ÁUDIO (DIESEL) 🎵
// ==========================================
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
let engineOsc: OscillatorNode; let engineSubOsc: OscillatorNode; let engineGain: GainNode; let engineFilter: BiquadFilterNode; let engineStarted = false;

const SoundFX = {
  iniciarMotor: () => {
    if (engineStarted) return; engineStarted = true;
    engineOsc = audioCtx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 25; 
    engineSubOsc = audioCtx.createOscillator(); engineSubOsc.type = 'square'; engineSubOsc.frequency.value = 12.5; 
    engineFilter = audioCtx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 150; engineFilter.Q.value = 2; 
    engineGain = audioCtx.createGain(); engineGain.gain.value = 0; 
    engineOsc.connect(engineFilter); engineSubOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioCtx.destination);
    engineOsc.start(); engineSubOsc.start();
  },
  atualizarMotor: (acelerando: boolean, noAr: boolean) => {
    if (!engineStarted) return;
    const freqAlvo = acelerando ? (noAr ? 90 : 50) : 25;
    engineGain.gain.setTargetAtTime(acelerando ? 0.35 : 0.15, audioCtx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(freqAlvo, audioCtx.currentTime, 0.1);
    engineSubOsc.frequency.setTargetAtTime(freqAlvo / 2, audioCtx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(acelerando ? 600 : 150, audioCtx.currentTime, 0.1);
  },
  pararMotor: () => { if (engineStarted) engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); },
  tocarMoeda: () => {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1); 
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  },
  tocarBatida: () => {
    const bufferSize = audioCtx.sampleRate * 0.2; const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 200; 
    const gain = audioCtx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    noise.start();
  }
};

// ==========================================
// DADOS DA SESSÃO BETA (Sem Save)
// ==========================================
let moedasColetadas = 0;

const CATÁLOGO_CARROS = [
  { id: 0, nome: 'A Braba', preco: 0, cor: 0xE53935, cabine: 0x8e0000, torque: 120, peso: 8.0, raioPneu: 25, freqMola: 3.0, fixBase: [70, 10, 0, 10], fixCab: [25, 20, 35, -20], fixTampa: [5, 25, -65, -25], rodaFX: 50, rodaTX: -50, cargoX: -25, suspY: 520, cargoY: 465 }
];

const desenharVisuaisDoCarro = (graphics: Phaser.GameObjects.Graphics) => {
  graphics.clear();
  const specs = CATÁLOGO_CARROS[0];
  graphics.fillGradientStyle(0xffffaa, 0xffffaa, 0xffffaa, 0xffffaa, 0.4, 0, 0.4, 0);
  graphics.fillTriangle(72, 5, 350, -60, 350, 100);
  graphics.fillStyle(specs.cabine).fillRoundedRect(-70, 0, 140, 20, 5); 
  graphics.fillStyle(specs.cor).fillRect(-65, -5, 130, 12); 
  graphics.fillStyle(0x000000, 0.2).fillRect(-65, 10, 130, 8); 
  graphics.fillStyle(0x222222).fillRoundedRect(60, 5, 12, 12, 3).fillRoundedRect(-75, 5, 12, 12, 3); 
  graphics.fillStyle(specs.cabine).beginPath().moveTo(10, 0).lineTo(20, -40).lineTo(60, -40).lineTo(60, 0).closePath().fillPath(); 
  graphics.fillStyle(0x90CAF9).fillRoundedRect(25, -35, 30, 22, 4); 
  graphics.fillStyle(0xffffff, 0.3).beginPath().moveTo(30, -35).lineTo(45, -35).lineTo(35, -13).lineTo(25, -13).closePath().fillPath(); 
  graphics.fillStyle(specs.cabine).fillRect(-70, -50, 10, 50); 
  graphics.fillStyle(0xFFFF00).fillCircle(72, 5, 5); 
  graphics.fillStyle(0xff0000).fillCircle(-70, 5, 4); 
};

const gerarTexturaRoda = (scene: Phaser.Scene, raio: number): Phaser.GameObjects.Graphics => {
  const g = scene.add.graphics();
  g.fillStyle(0x111111).fillCircle(0, 0, raio); g.lineStyle(6, 0x000000).strokeCircle(0, 0, raio); g.fillStyle(0x95a5a6).fillCircle(0, 0, raio * 0.6); g.fillStyle(0x7f8c8d).fillCircle(0, 0, raio * 0.45); g.lineStyle(5, 0x2c3e50);
  for(let i=0; i<6; i++) { const ang = (Math.PI * 2 / 6) * i; g.beginPath().moveTo(0, 0).lineTo(Math.cos(ang) * (raio * 0.6), Math.sin(ang) * (raio * 0.6)).strokePath(); }
  g.fillStyle(0x000000).fillCircle(0, 0, raio * 0.15); 
  return g;
};

const desenharPinheiro = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, scale: number) => {
  const corFolha = 0x27ae60; const corSombra = 0x1e8449; const corTronco = 0x5d4037;
  graphics.fillStyle(corTronco).fillRect(x - (5 * scale), y - (20 * scale), 10 * scale, 20 * scale);
  for(let i = 0; i < 3; i++) {
    const alturaY = y - (20 * scale) - (i * 25 * scale); const larguraBase = 30 * scale - (i * 5 * scale); const topoY = alturaY - (40 * scale);
    graphics.fillStyle(corSombra).fillTriangle(x, topoY, x - larguraBase, alturaY, x + larguraBase, alturaY); 
    graphics.fillStyle(corFolha).fillTriangle(x, topoY, x - larguraBase + 2, alturaY - 2, x + larguraBase - 2, alturaY - 2); 
  }
};

// ==========================================
// CENA DE INTERFACE (HUD)
// ==========================================
class HUDScene extends Phaser.Scene {
  hudBar!: Phaser.GameObjects.Rectangle; progressoLinhaBg!: Phaser.GameObjects.Rectangle; progressoBandeira!: Phaser.GameObjects.Text; progressoIcone!: Phaser.GameObjects.Text;
  cargasTexto!: Phaser.GameObjects.Text; moedasTexto!: Phaser.GameObjects.Text; distanciaTexto!: Phaser.GameObjects.Text;
  botaoReiniciarHUD!: Phaser.GameObjects.Text;
  modalBg!: Phaser.GameObjects.Rectangle; modalBox!: Phaser.GameObjects.Rectangle; statusTexto!: Phaser.GameObjects.Text; botaoAcaoCentralBg!: Phaser.GameObjects.Rectangle; botaoAcaoCentralTxt!: Phaser.GameObjects.Text;

  constructor() { super('HUDScene'); }

  create() {
    const w = this.scale.width; const h = this.scale.height;

    this.hudBar = this.add.rectangle(0, 0, w * 2, 70, 0x000000, 0.8).setOrigin(0, 0);
    this.progressoLinhaBg = this.add.rectangle(30, 20, w - 300, 6, 0x34495e).setOrigin(0, 0.5).setStrokeStyle(1, 0xbdc3c7);
    this.progressoBandeira = this.add.text(w - 270, 20, '🏁', { fontSize: '24px' }).setOrigin(0.5, 0.5);
    this.progressoIcone = this.add.text(30, 15, '🚛', { fontSize: '24px' }).setOrigin(0.5, 0.5);

    this.cargasTexto = this.add.text(30, 45, `📦 SEGURAS: 3/3`, { fontFamily: 'Verdana', fontSize: '16px', color: '#ecf0f1', fontStyle: 'bold' });
    this.moedasTexto = this.add.text(220, 45, `🪙 MOEDAS: ${moedasColetadas}`, { fontFamily: 'Verdana', fontSize: '16px', color: '#f1c40f', fontStyle: 'bold' });
    this.distanciaTexto = this.add.text(420, 45, `DISTÂNCIA: 0m`, { fontFamily: 'Verdana', fontSize: '16px', color: '#2ecc71', fontStyle: 'bold' });

    this.botaoReiniciarHUD = this.add.text(w - 20, 35, '🔄 RESETAR FASE', { fontFamily:'Verdana', fontSize: '14px', color: '#fff', backgroundColor: '#000', padding: { x: 15, y: 8 } }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setStroke('#e74c3c', 2);
    this.botaoReiniciarHUD.on('pointerdown', () => { SoundFX.pararMotor(); this.scene.stop(); this.scene.get('GameScene').scene.restart(); });

    this.modalBg = this.add.rectangle(w/2, h/2, w*2, h*2, 0x000000, 0.85).setVisible(false);
    this.modalBox = this.add.rectangle(w/2, h/2, 600, 300, 0x111111, 1).setStrokeStyle(4, 0x34495e).setVisible(false);
    this.statusTexto = this.add.text(w / 2, h / 2 - 40, '', { fontFamily: 'Impact', fontSize: '64px', color: '#ffffff', letterSpacing: 2 }).setOrigin(0.5).setVisible(false);
    this.botaoAcaoCentralBg = this.add.rectangle(w/2, h/2 + 70, 350, 60, 0x000, 0.8).setStrokeStyle(3, 0xe74c3c).setInteractive({ useHandCursor: true }).setVisible(false);
    this.botaoAcaoCentralTxt = this.add.text(w/2, h/2 + 70, '', { fontFamily: 'Verdana', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);

    this.scale.on('resize', this.redimensionar, this);
  }

  redimensionar(gameSize: Phaser.Structs.Size) {
    const w = gameSize.width; const h = gameSize.height;
    this.hudBar.setSize(w * 2, 70); this.progressoLinhaBg.setSize(w - 300, 6); this.progressoBandeira.setPosition(w - 270, 20);
    this.botaoReiniciarHUD.setPosition(w - 20, 35);
    this.modalBg.setPosition(w/2, h/2); this.modalBox.setPosition(w/2, h/2); this.statusTexto.setPosition(w/2, h/2 - 40); this.botaoAcaoCentralBg.setPosition(w/2, h/2 + 70); this.botaoAcaoCentralTxt.setPosition(w/2, h/2 + 70);
  }

  atualizarDados(distancia: number, moedas: number, progresso: number) {
    this.distanciaTexto.setText(`DISTÂNCIA: ${distancia}m`);
    this.moedasTexto.setText(`🪙 MOEDAS: ${moedas}`);
    this.progressoIcone.setPosition(30 + (progresso * (this.scale.width - 300)), 15);
  }

  exibirModal(mensagem: string, corMsg: string, txtBotao: string, corBotao: number, acaoBotao: Function) {
    this.modalBg.setVisible(true); this.modalBox.setVisible(true).setStrokeStyle(4, corBotao); this.statusTexto.setText(mensagem).setColor(corMsg).setVisible(true);
    this.botaoAcaoCentralBg.setStrokeStyle(3, corBotao).setVisible(true); this.botaoAcaoCentralTxt.setText(txtBotao).setColor(corMsg).setVisible(true);
    this.botaoAcaoCentralBg.off('pointerdown').on('pointerdown', acaoBotao as Function);
  }
  marcarCargaPerdida() { this.cargasTexto.setText('📦 SEGURAS: FALHA').setColor('#e74c3c'); }
}

// ==========================================
// CENA PRINCIPAL DO JOGO (Versão Beta)
// ==========================================
class GameScene extends Phaser.Scene {
  mundoFisico!: planck.World; 
  chassiBody!: planck.Body; rodaTrasBody!: planck.Body; rodaFrenteBody!: planck.Body; molaTras!: planck.WheelJoint; molaFrente!: planck.WheelJoint;
  cargasBodies: planck.Body[] = []; cargasVisuais: Phaser.GameObjects.Graphics[] = []; moedasBodies: planck.Body[] = []; moedasVisuais: Phaser.GameObjects.Graphics[] = [];
  carroVisual!: Phaser.GameObjects.Graphics; rodaTrasVisual!: Phaser.GameObjects.Graphics; rodaFrenteVisual!: Phaser.GameObjects.Graphics; terrenoVisual!: Phaser.GameObjects.Graphics;
  pedrasSoltasBodies: planck.Body[] = []; pedrasSoltasVisuais: Phaser.GameObjects.Graphics[] = [];
  arvoresVisuais!: Phaser.GameObjects.Graphics;
  poeiraEmitter!: Phaser.GameObjects.Particles.ParticleEmitter; cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  isGameOver: boolean = false; fimDoMapaX: number = 0; meuCarro: any; 
  bgGradient!: Phaser.GameObjects.Graphics;
  
  constructor() { super('GameScene'); }

  init() { this.meuCarro = CATÁLOGO_CARROS[0]; moedasColetadas = 0; }

  create() {
    this.isGameOver = false; this.cargasBodies = []; this.cargasVisuais = []; this.moedasBodies = []; this.moedasVisuais = []; this.pedrasSoltasBodies = []; this.pedrasSoltasVisuais = [];

    this.bgGradient = this.add.graphics().setScrollFactor(0);
    this.bgGradient.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xadd8e6, 0xffffff, 1).fillRect(-2000, -2000, 9999, 9999);

    this.mundoFisico = new planck.World(new planck.Vec2(0, 10));

    this.gerarMontanhasParallax();
    this.arvoresVisuais = this.add.graphics().setDepth(9);
    this.terrenoVisual = this.add.graphics().setDepth(10);
    
    this.gerarTerrenoBox2D();
    this.criarCarroBox2D();
    this.criarCargasBox2D();
    this.criarSistemaDePoeira();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.cameras.main.setZoom(0.7);

    this.scene.launch('HUDScene');
    this.scene.bringToTop('HUDScene');

    // Retoma o audio context caso o navegador bloqueie no inicio direto
    this.input.on('pointerdown', () => { if(audioCtx.state === 'suspended') audioCtx.resume(); });
    SoundFX.iniciarMotor();
    let ultimaBatida = 0;

    this.mundoFisico.on('begin-contact', (contact) => {
      let uA = contact.getFixtureA().getUserData(); let uB = contact.getFixtureB().getUserData();
      let fixA = contact.getFixtureA(); let fixB = contact.getFixtureB();

      if (uA === 'moeda' && (uB === 'chassi' || uB === 'roda')) this.coletarMoeda(fixA.getBody());
      if (uB === 'moeda' && (uA === 'chassi' || uA === 'roda')) this.coletarMoeda(fixB.getBody());
      if (uA === 'chegada' && (uB === 'chassi' || uB === 'roda' || uB === 'carga') || uB === 'chegada' && (uA === 'chassi' || uA === 'roda' || uA === 'carga')) this.vencerJogo();
      
      if ((uA === 'chassi' && (uB === 'ground' || uB === 'stone')) || (uB === 'chassi' && (uA === 'ground' || uA === 'stone'))) { 
        if (this.time.now - ultimaBatida > 300) { SoundFX.tocarBatida(); ultimaBatida = this.time.now; }
        if (Math.abs(this.chassiBody.getAngle()) > 1.4) this.perderJogo('CAPOTOU!'); 
      }
      if ((uA === 'carga' && (uB === 'ground' || uB === 'stone')) || (uB === 'carga' && (uA === 'ground' || uA === 'stone'))) this.perderJogo('CARGA CAIU!');
    });
  }

  gerarMontanhasParallax() {
    this.add.circle(200, 100, 80, 0xfff200, 1).setScrollFactor(0);
    const desenharCamada = (corTopo: number, corBase: number, scroll: number, alturaBase: number, amplitude: number, frequencia: number) => {
      const g = this.add.graphics().setScrollFactor(scroll);
      g.fillGradientStyle(corTopo, corTopo, corBase, corBase, 1);
      g.beginPath(); g.moveTo(-2000, 1500);
      for(let x = -2000; x <= 15000; x += 100) { g.lineTo(x, alturaBase + Math.sin(x * frequencia) * amplitude); }
      g.lineTo(15000, 1500).closePath().fillPath();
    };
    desenharCamada(0x2d5a27, 0x1e3f1a, 0.2, 400, 80, 0.002); desenharCamada(0x4a4a4a, 0x2c2c2c, 0.4, 480, 60, 0.004); desenharCamada(0x5d4037, 0x3e2723, 0.6, 550, 30, 0.008);
  }

  gerarTerrenoBox2D() {
    let xAnterior = -200; let yAnterior = 550;
    const tamanhoSegmento = 40; 
    const totalSegmentos = 300; // 1 Fase Grande Completa

    const groundBody = this.mundoFisico.createBody();
    const linhaBase = this.add.graphics().setDepth(9); const linhaMeio = this.add.graphics().setDepth(10); const linhaTopo = this.add.graphics().setDepth(11);
    
    let cBase = 0x3e2723; let cMeio = 0x1e8449; let cTopo = 0x2ecc71;

    linhaBase.fillStyle(cBase); linhaBase.beginPath().moveTo(xAnterior, 1500).lineTo(xAnterior, yAnterior + 12);
    linhaMeio.lineStyle(24, cMeio); linhaMeio.beginPath().moveTo(xAnterior, yAnterior + 12); 
    linhaTopo.lineStyle(8, cTopo); linhaTopo.beginPath().moveTo(xAnterior, yAnterior + 4);

    let i = 0;
    while (i < totalSegmentos) { 
      let xAtual = xAnterior + tamanhoSegmento;
      let yAtual = 550;
      let fixedBumps = Math.sin(i * 0.8) * 6; 

      if (i > 10) yAtual = 550 + Math.sin(i * 0.1) * 40; 
      yAtual += fixedBumps;

      groundBody.createFixture(planck.Edge(new planck.Vec2(xAnterior * P2M, yAnterior * P2M), new planck.Vec2(xAtual * P2M, yAtual * P2M)), { friction: 0.9, userData: 'ground' });
      
      linhaBase.lineTo(xAtual, yAtual + 12); linhaMeio.lineTo(xAtual, yAtual + 12); linhaTopo.lineTo(xAtual, yAtual + 4);
      
      if (i > 15 && Math.random() > 0.85) desenharPinheiro(this.arvoresVisuais, xAtual, yAtual, 0.7 + Math.random() * 0.5);
      if (i > 20 && Math.random() > 0.95) this.criarMoeda(xAnterior, yAnterior - 30);
      if (i > 25 && Math.random() > 0.96) this.criarPedraSolta(xAtual, yAtual - 20);

      xAnterior = xAtual; yAnterior = yAtual; i++;
    }
    
    linhaBase.lineTo(xAnterior, 1500).closePath().fillPath();
    linhaMeio.strokePath(); linhaTopo.strokePath();
    this.fimDoMapaX = xAnterior;

    const chegadaBody = this.mundoFisico.createBody(new planck.Vec2((xAnterior + 100) * P2M, (yAnterior - 200) * P2M));
    chegadaBody.createFixture(planck.Box(50 * P2M, 400 * P2M), { isSensor: true, userData: 'chegada' });
    
    const bandeira = this.add.graphics();
    bandeira.fillStyle(0xffffff).fillRect(xAnterior + 80, yAnterior - 300, 10, 300);
    for(let bx=0; bx<4; bx++){ for(let by=0; by<3; by++) { bandeira.fillStyle((bx+by)%2===0?0x000000:0xffffff).fillRect(xAnterior + 90 + bx*20, yAnterior - 300 + by*20, 20, 20); } }
  }

  criarMoeda(x: number, y: number) {
    const moedaBody = this.mundoFisico.createBody(new planck.Vec2(x * P2M, y * P2M));
    moedaBody.createFixture(planck.Circle(15 * P2M), { isSensor: true, userData: 'moeda' });
    this.moedasBodies.push(moedaBody);
    
    const moedaVis = this.add.graphics({ x: x, y: y });
    moedaVis.fillStyle(0xf1c40f).fillCircle(0, 0, 15).fillStyle(0xf39c12).fillCircle(0, 0, 10).fillStyle(0xffffff).fillCircle(-4, -4, 3); 
    this.moedasVisuais.push(moedaVis);
    this.tweens.add({ targets: moedaVis, y: y - 10, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  coletarMoeda(body: planck.Body) {
    const index = this.moedasBodies.indexOf(body);
    if (index > -1) {
      this.mundoFisico.destroyBody(body); this.moedasBodies.splice(index, 1);
      const vis = this.moedasVisuais[index];
      this.tweens.add({ targets: vis, y: vis.y - 50, alpha: 0, scale: 2, duration: 300, onComplete: () => vis.destroy() });
      this.moedasVisuais.splice(index, 1);
      SoundFX.tocarMoeda(); 
      moedasColetadas++;
    }
  }

  criarPedraSolta(x: number, y: number) {
      const pedraBody = this.mundoFisico.createDynamicBody(new planck.Vec2(x * P2M, y * P2M));
      pedraBody.createFixture(planck.Circle(12 * P2M), { density: 1.0, friction: 3.0, restitution: 0.1, userData: 'stone' }); 
      this.pedrasSoltasBodies.push(pedraBody);
      const g = this.add.graphics({ x: x, y: y });
      g.fillStyle(0x5d4037).beginPath().moveTo(-9,-3).lineTo(0,-12).lineTo(12,-6).lineTo(9,6).lineTo(0,12).lineTo(-12,9).closePath().fillPath();
      g.fillStyle(0x3e2723, 0.4).fillCircle(3,-3, 3); g.fillStyle(0x8d6e63, 0.4).fillCircle(-4,-6, 2); 
      this.pedrasSoltasVisuais.push(g);
  }

  criarSistemaDePoeira() {
    this.poeiraEmitter = this.add.particles(0, 0, 'flares', { lifespan: 500, speedX: { min: -100, max: -200 }, speedY: { min: -50, max: 0 }, scale: { start: 1, end: 0 }, alpha: { start: 0.5, end: 0 }, tint: 0x5D4037, blendMode: 'NORMAL', emitting: false });
    if (!this.textures.exists('poeiraPixel')) { const g = this.make.graphics({x:0,y:0}); g.fillStyle(0xffffff).fillCircle(6, 6, 6); g.generateTexture('poeiraPixel', 12, 12); }
    this.poeiraEmitter.setTexture('poeiraPixel');
  }

  criarCarroBox2D() {
    const specs = this.meuCarro; const startX = 50; const startY = 300; 
    const CAT_DEFAULT = 0x0001; const CAT_WHEEL = 0x0002;

    this.chassiBody = this.mundoFisico.createDynamicBody({ position: new planck.Vec2(startX * P2M, startY * P2M), angularDamping: 4.0 });
    this.chassiBody.createFixture(planck.Box(specs.fixBase[0] * P2M, specs.fixBase[1] * P2M, new planck.Vec2(specs.fixBase[2] * P2M, specs.fixBase[3] * P2M), 0), { density: specs.peso, userData: 'chassi', filterCategoryBits: CAT_DEFAULT });
    this.chassiBody.createFixture(planck.Box(specs.fixCab[0] * P2M, specs.fixCab[1] * P2M, new planck.Vec2(specs.fixCab[2] * P2M, specs.fixCab[3] * P2M), 0), { density: 0.1, userData: 'chassi', filterCategoryBits: CAT_DEFAULT });
    this.chassiBody.createFixture(planck.Box(specs.fixTampa[0] * P2M, specs.fixTampa[1] * P2M, new planck.Vec2(specs.fixTampa[2] * P2M, specs.fixTampa[3] * P2M), 0), { density: 0.1, userData: 'chassi', filterCategoryBits: CAT_DEFAULT });

    const fdRoda = { density: 1.0, friction: 4.0, restitution: 0.0, userData: 'roda', filterCategoryBits: CAT_WHEEL, filterMaskBits: CAT_DEFAULT | CAT_WHEEL };
    const alturaSuspensao = specs.suspY - 480;

    this.rodaTrasBody = this.mundoFisico.createDynamicBody(new planck.Vec2((startX + specs.rodaTX) * P2M, (startY + alturaSuspensao) * P2M));
    this.rodaTrasBody.createFixture(planck.Circle(specs.raioPneu * P2M), fdRoda);
    this.rodaFrenteBody = this.mundoFisico.createDynamicBody(new planck.Vec2((startX + specs.rodaFX) * P2M, (startY + alturaSuspensao) * P2M));
    this.rodaFrenteBody.createFixture(planck.Circle(specs.raioPneu * P2M), fdRoda);

    const eixoSuspensao = new planck.Vec2(0, 1); 
    this.molaTras = this.mundoFisico.createJoint(planck.WheelJoint({ enableMotor: true, maxMotorTorque: specs.torque * 2, motorSpeed: 0.0, frequencyHz: specs.freqMola, dampingRatio: 0.85 }, this.chassiBody, this.rodaTrasBody, this.rodaTrasBody.getPosition(), eixoSuspensao)) as planck.WheelJoint;
    this.molaFrente = this.mundoFisico.createJoint(planck.WheelJoint({ enableMotor: true, maxMotorTorque: specs.torque * 2, motorSpeed: 0.0, frequencyHz: specs.freqMola, dampingRatio: 0.85 }, this.chassiBody, this.rodaFrenteBody, this.rodaFrenteBody.getPosition(), eixoSuspensao)) as planck.WheelJoint;

    this.carroVisual = this.add.graphics(); desenharVisuaisDoCarro(this.carroVisual);
    this.rodaTrasVisual = gerarTexturaRoda(this, specs.raioPneu); this.rodaFrenteVisual = gerarTexturaRoda(this, specs.raioPneu);
  }

  criarCargasBox2D() {
    const specs = this.meuCarro; const cX = 50 + specs.cargoX; 
    const posicoesIniciais = [ { x: cX - 15, y: 285 }, { x: cX + 15, y: 285 }, { x: cX, y: 260 } ];
    const CAT_DEFAULT = 0x0001; const CAT_CARGO = 0x0004;

    for(let i = 0; i < 3; i++) {
      const boxBody = this.mundoFisico.createDynamicBody(new planck.Vec2(posicoesIniciais[i].x * P2M, posicoesIniciais[i].y * P2M));
      boxBody.createFixture(planck.Box(12 * P2M, 12 * P2M), { density: 0.5, friction: 0.9, userData: 'carga', filterCategoryBits: CAT_CARGO, filterMaskBits: CAT_DEFAULT | CAT_CARGO });
      this.cargasBodies.push(boxBody);
      
      const g = this.add.graphics(); g.fillStyle(0xd35400).fillRect(-12, -12, 24, 24); g.lineStyle(2, 0x873600).strokeRect(-12, -12, 24, 24); g.beginPath().moveTo(-12, -12).lineTo(12, 12).strokePath().moveTo(12, -12).lineTo(-12, 12).strokePath(); 
      this.cargasVisuais.push(g);
    }
  }

  perderJogo(motivo: string) {
    if (this.isGameOver) return; this.isGameOver = true;
    SoundFX.pararMotor(); SoundFX.tocarBatida(); 
    this.poeiraEmitter.stop(); this.cameras.main.shake(400, 0.02);
    
    const hud = this.scene.get('HUDScene') as HUDScene;
    if(hud) {
      hud.marcarCargaPerdida();
      hud.exibirModal(motivo, '#e74c3c', 'TENTAR NOVAMENTE', 0xc0392b, () => {
        this.scene.stop('HUDScene'); this.scene.restart();
      });
    }
  }

  vencerJogo() {
    if (this.isGameOver) return; this.isGameOver = true;
    SoundFX.pararMotor();
    this.molaTras.setMotorSpeed(0); this.molaFrente.setMotorSpeed(0); this.poeiraEmitter.stop();
    
    const hud = this.scene.get('HUDScene') as HUDScene;
    if(hud) {
      hud.exibirModal('BETA CONCLUÍDO!', '#f1c40f', 'JOGAR NOVAMENTE', 0xd35400, () => { 
        this.scene.stop('HUDScene'); this.scene.restart(); 
      });
    }
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;
    this.mundoFisico.step(delta / 1000);
    if (this.isGameOver) return;

    const posChassi = this.chassiBody.getPosition();
    this.carroVisual.setPosition(posChassi.x * M2P, posChassi.y * M2P).setRotation(this.chassiBody.getAngle());
    
    const posRT = this.rodaTrasBody.getPosition();
    this.rodaTrasVisual.setPosition(posRT.x * M2P, posRT.y * M2P).setRotation(this.rodaTrasBody.getAngle());
    const posRF = this.rodaFrenteBody.getPosition();
    this.rodaFrenteVisual.setPosition(posRF.x * M2P, posRF.y * M2P).setRotation(this.rodaFrenteBody.getAngle());

    for(let i = 0; i < this.cargasBodies.length; i++) {
      const posCarga = this.cargasBodies[i].getPosition();
      this.cargasVisuais[i].setPosition(posCarga.x * M2P, posCarga.y * M2P).setRotation(this.cargasBodies[i].getAngle());
    }

    for(let i = 0; i < this.pedrasSoltasBodies.length; i++) {
        const corpo = this.pedrasSoltasBodies[i];
        this.pedrasSoltasVisuais[i].setPosition(corpo.getPosition().x * M2P, corpo.getPosition().y * M2P).setRotation(corpo.getAngle());
    }

    this.cameras.main.scrollX = (posChassi.x * M2P) - (this.scale.width / 2) + 200; 
    this.cameras.main.scrollY = (posChassi.y * M2P) - (this.scale.height / 2) + 100;

    if (posChassi.y * M2P > 1200) { this.perderJogo('CAIU NO ABISMO!'); return; }

    let porcentagem = (posChassi.x * M2P - 200) / (this.fimDoMapaX - 200);
    const distReal = Math.max(0, Math.floor((posChassi.x * M2P - 200) / 50));
    
    const hud = this.scene.get('HUDScene') as HUDScene;
    if(hud && hud.atualizarDados) hud.atualizarDados(distReal, moedasColetadas, Phaser.Math.Clamp(porcentagem, 0, 1));

    let noChao = false;
    for (let ce = this.rodaTrasBody.getContactList(); ce; ce = ce.next) { if (ce.contact.isTouching() && (ce.contact.getFixtureA().getUserData() === 'ground' || ce.contact.getFixtureA().getUserData() === 'stone' || ce.contact.getFixtureB().getUserData() === 'ground' || ce.contact.getFixtureB().getUserData() === 'stone')) noChao = true; }
    for (let ce = this.rodaFrenteBody.getContactList(); ce; ce = ce.next) { if (ce.contact.isTouching() && (ce.contact.getFixtureA().getUserData() === 'ground' || ce.contact.getFixtureA().getUserData() === 'stone' || ce.contact.getFixtureB().getUserData() === 'ground' || ce.contact.getFixtureB().getUserData() === 'stone')) noChao = true; }

    const velocidadeRad = Math.PI * 12; 
    const forcaInclinar = noChao ? 0.5 : 3.5; 

    SoundFX.atualizarMotor(this.cursors.right.isDown || this.cursors.left.isDown, !noChao);

    if (this.cursors.right.isDown) {
      this.molaTras.setMotorSpeed(velocidadeRad); this.molaFrente.setMotorSpeed(velocidadeRad);
      this.chassiBody.applyAngularImpulse(-forcaInclinar, true); 
      if (noChao) { this.poeiraEmitter.start(); this.poeiraEmitter.setPosition(posRT.x * M2P, posRT.y * M2P + 20); } else { this.poeiraEmitter.stop(); }
    } 
    else if (this.cursors.left.isDown) {
      this.molaTras.setMotorSpeed(-velocidadeRad); this.molaFrente.setMotorSpeed(-velocidadeRad);
      this.chassiBody.applyAngularImpulse(forcaInclinar, true); this.poeiraEmitter.stop();
    } 
    else {
      this.molaTras.setMotorSpeed(0); this.molaFrente.setMotorSpeed(0); this.poeiraEmitter.stop();
    }
  }
}

const config: Phaser.Types.Core.GameConfig = { 
  type: Phaser.AUTO, 
  scale: { mode: Phaser.Scale.RESIZE, parent: document.body, width: '100%', height: '100%' }, 
  scene: [GameScene, HUDScene] // Boot direto no jogo
};

new Phaser.Game(config);
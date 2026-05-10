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
    
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 25; 
    
    engineSubOsc = audioCtx.createOscillator();
    engineSubOsc.type = 'square';
    engineSubOsc.frequency.value = 12.5; 

    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass'; 
    engineFilter.frequency.value = 150; 
    engineFilter.Q.value = 2; 

    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0; 
    
    engineOsc.connect(engineFilter); 
    engineSubOsc.connect(engineFilter);
    engineFilter.connect(engineGain); 
    engineGain.connect(audioCtx.destination);
    
    engineOsc.start();
    engineSubOsc.start();
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
// SISTEMA DE SAVE E CATÁLOGO
// ==========================================
let gameData = JSON.parse(localStorage.getItem('giroAltoSave') || '{"moedas":0,"unlocked":[0],"activeCar":0}');
const salvarJogo = () => { localStorage.setItem('giroAltoSave', JSON.stringify(gameData)); };

const CATÁLOGO_CARROS = [
  { id: 0, nome: 'Pick-Up', preco: 0, cor: 0xE53935, cabine: 0x8e0000, torque: 120, peso: 8.0, raioPneu: 25, freqMola: 3.0, fixBase: [70, 10, 0, 10], fixCab: [25, 20, 35, -20], fixTampa: [5, 25, -65, -25], rodaFX: 50, rodaTX: -50, cargoX: -25, suspY: 520, cargoY: 465 },
  { id: 1, nome: 'Pick-Up Off-Road', preco: 30, cor: 0x2980b9, cabine: 0x154360, torque: 150, peso: 6.0, raioPneu: 28, freqMola: 3.5, fixBase: [80, 12.5, 0, 12.5], fixCab: [30, 22.5, 20, -22.5], fixTampa: [6, 25, -74, -25], rodaFX: 60, rodaTX: -60, cargoX: -35, suspY: 525, cargoY: 460 },
  { id: 2, nome: 'Truck', preco: 80, cor: 0xf1c40f, cabine: 0x935116, torque: 220, peso: 14.0, raioPneu: 34, freqMola: 3.5, fixBase: [120, 15, 0, 15], fixCab: [35, 35, 85, -35], fixTampa: [7.5, 20, -112.5, -20], rodaFX: 90, rodaTX: -80, cargoX: -40, suspY: 545, cargoY: 450 } 
];

const desenharVisuaisDoCarro = (graphics: Phaser.GameObjects.Graphics, id: number) => {
  graphics.clear();
  const specs = CATÁLOGO_CARROS.find(c => c.id === id)!;
  
  graphics.fillGradientStyle(0xffffaa, 0xffffaa, 0xffffaa, 0xffffaa, 0.4, 0, 0.4, 0);
  if (id === 0) graphics.fillTriangle(72, 5, 350, -60, 350, 100);
  if (id === 1) graphics.fillTriangle(82, 8, 350, -60, 350, 100);
  if (id === 2) graphics.fillTriangle(122, 15, 400, -60, 400, 120);

  if (id === 0) { 
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
  } 
  else if (id === 1) { 
    graphics.fillStyle(specs.cabine).fillRoundedRect(-80, 0, 160, 25, 8); 
    graphics.fillStyle(specs.cor).fillRect(-75, -8, 150, 14); 
    graphics.fillStyle(0x000000, 0.3).fillRect(-75, 12, 150, 10); 
    graphics.fillStyle(0x111).fillRoundedRect(70, 5, 15, 18, 4).fillRoundedRect(-85, 5, 15, 18, 4); 
    graphics.fillStyle(specs.cabine).beginPath().moveTo(-10, 0).lineTo(0, -45).lineTo(50, -45).lineTo(50, 0).closePath().fillPath(); 
    graphics.lineStyle(5, 0x2c3e50).beginPath().moveTo(0, -45).lineTo(-60, 0).strokePath().moveTo(-10, -45).lineTo(-70, 0).strokePath(); 
    graphics.fillStyle(0x90CAF9).fillRoundedRect(5, -40, 40, 22, 4); 
    graphics.fillStyle(0xffffff, 0.3).beginPath().moveTo(10, -40).lineTo(25, -40).lineTo(15, -18).lineTo(5, -18).closePath().fillPath(); 
    graphics.fillStyle(specs.cabine).fillRect(-80, -50, 12, 50); 
    graphics.fillStyle(0xFFFF00).fillCircle(82, 8, 6); 
    graphics.fillStyle(0xff0000).fillCircle(-82, 8, 5);
  } 
  else if (id === 2) { 
    graphics.fillStyle(specs.cabine).fillRect(-120, 0, 240, 30); 
    graphics.fillStyle(specs.cor).fillRect(-115, -10, 230, 20);
    graphics.fillStyle(0x000000, 0.3).fillRect(-115, 15, 230, 15);
    graphics.fillStyle(0x222).fillRoundedRect(110, 10, 18, 20, 4).fillRoundedRect(-125, 10, 18, 20, 4);
    graphics.fillStyle(specs.cabine).fillRoundedRect(50, -70, 70, 70, 5); 
    graphics.fillStyle(0x7f8c8d).fillRect(35, -100, 14, 100); 
    graphics.fillStyle(0x2c3e50).fillRect(33, -100, 18, 15); 
    graphics.fillStyle(0x90CAF9).fillRoundedRect(60, -60, 50, 30, 4); 
    graphics.fillStyle(0xffffff, 0.3).beginPath().moveTo(70, -60).lineTo(90, -60).lineTo(80, -30).lineTo(60, -30).closePath().fillPath(); 
    graphics.fillStyle(specs.cabine).fillRect(-120, -40, 15, 40); 
    graphics.fillStyle(0xFFFF00).fillCircle(120, 15, 8); 
    graphics.fillStyle(0xff0000).fillCircle(-120, 15, 6); 
  }
};

const gerarTexturaRoda = (scene: Phaser.Scene, raio: number): Phaser.GameObjects.Graphics => {
  const g = scene.add.graphics();
  g.fillStyle(0x111111).fillCircle(0, 0, raio); 
  g.lineStyle(6, 0x000000).strokeCircle(0, 0, raio); 
  g.fillStyle(0x95a5a6).fillCircle(0, 0, raio * 0.6); 
  g.fillStyle(0x7f8c8d).fillCircle(0, 0, raio * 0.45); 
  g.lineStyle(5, 0x2c3e50);
  for(let i=0; i<6; i++) { 
    const ang = (Math.PI * 2 / 6) * i; 
    g.beginPath().moveTo(0, 0).lineTo(Math.cos(ang) * (raio * 0.6), Math.sin(ang) * (raio * 0.6)).strokePath(); 
  }
  g.fillStyle(0x000000).fillCircle(0, 0, raio * 0.15); 
  return g;
};

// ==========================================
// DESENHAR ÁRVORES (PINHEIROS)
// ==========================================
const desenharPinheiro = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, escura: boolean = false) => {
  const corFolha = escura ? 0x1e3f1a : 0x27ae60;
  const corSombra = escura ? 0x142b11 : 0x1e8449;
  const corTronco = 0x5d4037;

  graphics.fillStyle(corTronco).fillRect(x - (5 * scale), y - (20 * scale), 10 * scale, 20 * scale); // Tronco
  for(let i = 0; i < 3; i++) {
    const alturaY = y - (20 * scale) - (i * 25 * scale);
    const larguraBase = 30 * scale - (i * 5 * scale);
    const topoY = alturaY - (40 * scale);
    graphics.fillStyle(corSombra).fillTriangle(x, topoY, x - larguraBase, alturaY, x + larguraBase, alturaY); 
    graphics.fillStyle(corFolha).fillTriangle(x, topoY, x - larguraBase + 2, alturaY - 2, x + larguraBase - 2, alturaY - 2); 
  }
};

// ==========================================
// FUNÇÃO DE FUNDO NATUREZA (AZUL E VERDE)
// ==========================================
const desenharFundoLindo = (scene: Phaser.Scene, width: number, height: number) => {
  const bg = scene.add.graphics();
  // Céu Azul
  bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xadd8e6, 0xffffff, 1);
  bg.fillRect(0, 0, width, height);

  // Sol
  scene.add.circle(width * 0.15, height * 0.2, Math.min(width, height) * 0.1, 0xfff200, 1);

  const desenharCamada = (corTopo: number, corBase: number, alturaBase: number, amplitude: number, frequencia: number) => {
    const g = scene.add.graphics();
    g.fillGradientStyle(corTopo, corTopo, corBase, corBase, 1);
    g.beginPath(); g.moveTo(0, height);
    for(let x = 0; x <= width + 100; x += 50) { g.lineTo(x, alturaBase + Math.sin(x * frequencia) * amplitude); }
    g.lineTo(width, height).closePath().fillPath();
  };

  desenharCamada(0x2d5a27, 0x1e3f1a, height * 0.55, 60, 0.004); 
  desenharCamada(0x4a4a4a, 0x2c2c2c, height * 0.70, 40, 0.007); 
  desenharCamada(0x5d4037, 0x3e2723, height * 0.85, 20, 0.012); 
};

// ==========================================
// CENA 1: MENU INICIAL PROFISSIONAL
// ==========================================
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create() {
    const w = this.scale.width; const h = this.scale.height;
    desenharFundoLindo(this, w, h);

    const particles = this.add.particles(0, 0, 'flares', { x: {min: 0, max: w}, y: {min: h*0.5, max: h}, lifespan: 4000, speedY: {min: -10, max: -30}, scale: {start: 0.5, end: 0}, alpha: {start: 0.3, end: 0}, frequency: 100 });
    if (!this.textures.exists('dust')) { const g = this.make.graphics({x:0,y:0}); g.fillStyle(0xffffff).fillCircle(4, 4, 4); g.generateTexture('dust', 8, 8); }
    particles.setTexture('dust');

    this.add.rectangle(w / 2, h / 2, Math.min(w * 0.85, 800), h * 0.90, 0x0a0a0a, 0.85).setStrokeStyle(2, 0xf1c40f);
    
    this.add.text(w / 2 + 4, h * 0.12 + 4, 'GIRO ALTO', { fontFamily: 'Impact', fontSize: '72px', color: '#000', padding: { left: 20, right: 20, top: 10, bottom: 10 } }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.12, 'GIRO ALTO', { fontFamily: 'Impact', fontSize: '72px', color: '#f1c40f', fontStyle: 'italic', stroke: '#2c3e50', strokeThickness: 8, shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 0, fill: true }, padding: { left: 20, right: 20, top: 10, bottom: 10 } }).setOrigin(0.5);
    
    this.add.rectangle(w / 2, h * 0.22, 400, 2, 0xf1c40f, 0.5);

    const textoNarrativa = "ANO 2040: AS ESTRADAS FORAM DESTRUÍDAS.\nVocê é o último motorista capaz de levar suprimentos vitais\natravés das rotas mais perigosas do mundo.\n\nGERENCIE A FÍSICA. CONTROLE A TRAÇÃO. PROTEJA A CARGA.";
    this.add.text(w / 2, h * 0.32, textoNarrativa, { fontFamily: 'Verdana', fontSize: '18px', color: '#ecf0f1', align: 'center', lineSpacing: 6, fontStyle: 'bold', shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true } }).setOrigin(0.5);
    
    this.add.rectangle(w / 2, h * 0.46, 250, 45, 0x000000, 0.9).setStrokeStyle(2, 0xf1c40f);
    this.add.text(w / 2, h * 0.46, `🪙 SALDO: ${gameData.moedas}`, { fontFamily: 'Impact', fontSize: '24px', color: '#f1c40f', letterSpacing: 2 }).setOrigin(0.5);

    const criarBotao = (y: number, texto: string, cor: string, acao: Function) => {
      const btnBg = this.add.rectangle(w / 2, y, 350, 50, 0x000, 0.8).setInteractive({ useHandCursor: true }).setStrokeStyle(3, parseInt(cor.replace('#', '0x')));
      const txt = this.add.text(w / 2, y, texto, { fontFamily: 'Verdana', fontSize: '18px', color: cor, fontStyle: 'bold' }).setOrigin(0.5);
      btnBg.on('pointerover', () => { btnBg.setScale(1.05); txt.setScale(1.05); btnBg.setFillStyle(parseInt(cor.replace('#', '0x')), 1); txt.setColor('#fff'); });
      btnBg.on('pointerout', () => { btnBg.setScale(1); txt.setScale(1); btnBg.setFillStyle(0x000, 0.8); txt.setColor(cor); });
      btnBg.on('pointerdown', () => { if(audioCtx.state === 'suspended') audioCtx.resume(); acao(); });
    };

    criarBotao(h * 0.58, '▶ FASE 1: Colinas Verdes', '#2ecc71', () => this.scene.start('GameScene', { level: 1 }));
    criarBotao(h * 0.68, '▶ FASE 2: Floresta Sombria', '#e67e22', () => this.scene.start('GameScene', { level: 2 }));
    criarBotao(h * 0.78, '▶ FASE 3: Deserto Rochoso', '#e74c3c', () => this.scene.start('GameScene', { level: 3 }));
    criarBotao(h * 0.88, '🛒 ACESSAR GARAGEM', '#3498db', () => this.scene.start('ShopScene'));
  }
}

// ==========================================
// CENA 2: LOJA DE CARROS
// ==========================================
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }
  create() {
    const w = this.scale.width; const h = this.scale.height;
    desenharFundoLindo(this, w, h);

    this.add.text(w / 2 + 4, 84, 'GARAGEM', { fontFamily: 'Impact', fontSize: '56px', color: '#000', padding: { right: 15 } }).setOrigin(0.5);
    this.add.text(w / 2, 80, 'GARAGEM', { fontFamily: 'Impact', fontSize: '56px', color: '#ffffff', stroke: '#000', strokeThickness: 6, padding: { right: 15 } }).setOrigin(0.5);
    
    this.add.rectangle(w / 2, 140, 300, 50, 0x000000, 0.7).setStrokeStyle(2, 0xf1c40f).setOrigin(0.5);
    this.add.text(w / 2, 140, `🪙 MOEDAS: ${gameData.moedas}`, { fontFamily: 'Verdana', fontSize: '24px', color: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5);

    const espacamento = w / 4;
    CATÁLOGO_CARROS.forEach((carro, index) => {
      const xPos = espacamento * (index + 1);
      
      this.add.rectangle(xPos + 10, h / 2 + 30, 300, 400, 0x000, 0.5);
      this.add.rectangle(xPos, h / 2 + 20, 300, 400, 0x111, 0.9).setStrokeStyle(3, 0x3498db);
      
      const arteCarro = this.add.graphics({ x: xPos, y: h / 2 - 80 }); desenharVisuaisDoCarro(arteCarro, carro.id);
      
      const despRoda = (carro.suspY - 480);
      gerarTexturaRoda(this, carro.raioPneu).setPosition(xPos + carro.rodaTX, h / 2 - 80 + despRoda);
      gerarTexturaRoda(this, carro.raioPneu).setPosition(xPos + carro.rodaFX, h / 2 - 80 + despRoda);

      this.add.text(xPos, h / 2 + 10, carro.nome, { fontFamily: 'Verdana', fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(xPos, h / 2 + 60, `Torque: ${carro.torque}\nPeso: ${carro.peso}t\nPneus: ${carro.raioPneu}"`, { fontFamily: 'Verdana', fontSize: '16px', color: '#bdc3c7', align: 'center' }).setOrigin(0.5);

      const isUnlocked = gameData.unlocked.includes(carro.id); const isActive = gameData.activeCar === carro.id;
      const btnBg = this.add.rectangle(xPos, h / 2 + 150, 220, 50, isActive ? 0x27ae60 : (isUnlocked ? 0x2980b9 : 0x000), isActive||isUnlocked ? 1 : 0.8).setInteractive({ useHandCursor: true }).setStrokeStyle(2, isActive ? 0x2ecc71 : (isUnlocked ? 0x3498db : 0xe74c3c));
      this.add.text(xPos, h / 2 + 150, isActive ? 'SELECIONADO' : (isUnlocked ? 'EQUIPAR' : `COMPRAR 🪙 ${carro.preco}`), { fontFamily: 'Verdana', fontSize: '18px', color: isActive||isUnlocked ? '#fff' : '#e74c3c', fontStyle: 'bold' }).setOrigin(0.5);

      btnBg.on('pointerdown', () => {
        if (isUnlocked) { gameData.activeCar = carro.id; salvarJogo(); this.scene.restart(); }
        else if (gameData.moedas >= carro.preco) { gameData.moedas -= carro.preco; gameData.unlocked.push(carro.id); gameData.activeCar = carro.id; salvarJogo(); SoundFX.tocarMoeda(); this.scene.restart(); }
        else { this.cameras.main.shake(200, 0.01); SoundFX.tocarBatida(); }
      });
    });

    const btnVoltar = this.add.text(20, 20, '⬅ VOLTAR', { fontSize: '20px', color: '#e74c3c', backgroundColor: '#000', padding: { x: 15, y: 10 } }).setStroke('#e74c3c', 2).setInteractive({ useHandCursor: true });
    btnVoltar.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

// ==========================================
// CENA 3: HUD SCENE
// ==========================================
class HUDScene extends Phaser.Scene {
  hudBar!: Phaser.GameObjects.Rectangle; progressoLinhaBg!: Phaser.GameObjects.Rectangle; progressoBandeira!: Phaser.GameObjects.Text; progressoIcone!: Phaser.GameObjects.Text;
  cargasTexto!: Phaser.GameObjects.Text; moedasTexto!: Phaser.GameObjects.Text; distanciaTexto!: Phaser.GameObjects.Text;
  botaoMenuHUD!: Phaser.GameObjects.Text; botaoReiniciarHUD!: Phaser.GameObjects.Text;
  modalBg!: Phaser.GameObjects.Rectangle; modalBox!: Phaser.GameObjects.Rectangle; statusTexto!: Phaser.GameObjects.Text; botaoAcaoCentralBg!: Phaser.GameObjects.Rectangle; botaoAcaoCentralTxt!: Phaser.GameObjects.Text;
  faseAtual: number = 1;

  isAcelerando: boolean = false;
  isFreando: boolean = false;

  constructor() { super('HUDScene'); }
  init(data: any) { this.faseAtual = data.fase || 1; }

  create() {
    const w = this.scale.width; const h = this.scale.height;

    this.hudBar = this.add.rectangle(0, 0, w * 2, 70, 0x000000, 0.8).setOrigin(0, 0);
    this.progressoLinhaBg = this.add.rectangle(30, 20, w - 300, 6, 0x34495e).setOrigin(0, 0.5).setStrokeStyle(1, 0xbdc3c7);
    this.progressoBandeira = this.add.text(w - 270, 20, '🏁', { fontSize: '24px' }).setOrigin(0.5, 0.5);
    this.progressoIcone = this.add.text(30, 15, '🚚', { fontSize: '24px' }).setOrigin(0.5, 0.5);

    this.cargasTexto = this.add.text(30, 45, `📦 SEGURAS: 3/3`, { fontFamily: 'Verdana', fontSize: '16px', color: '#ecf0f1', fontStyle: 'bold' });
    this.moedasTexto = this.add.text(220, 45, `🪙 MOEDAS: ${gameData.moedas}`, { fontFamily: 'Verdana', fontSize: '16px', color: '#f1c40f', fontStyle: 'bold' });
    this.distanciaTexto = this.add.text(420, 45, `DISTÂNCIA: 0m`, { fontFamily: 'Verdana', fontSize: '16px', color: '#2ecc71', fontStyle: 'bold' });

    this.botaoMenuHUD = this.add.text(w - 20, 35, '🏠 MENU', { fontFamily:'Verdana', fontSize: '14px', color: '#fff', backgroundColor: '#000', padding: { x: 15, y: 8 } }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setStroke('#3498db', 2);
    this.botaoReiniciarHUD = this.add.text(w - 130, 35, '🔄 RESET', { fontFamily:'Verdana', fontSize: '14px', color: '#fff', backgroundColor: '#000', padding: { x: 15, y: 8 } }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setStroke('#e74c3c', 2);
    
    this.botaoMenuHUD.on('pointerdown', () => { SoundFX.pararMotor(); this.scene.get('GameScene').scene.stop(); this.scene.start('MenuScene'); });
    this.botaoReiniciarHUD.on('pointerdown', () => { SoundFX.pararMotor(); this.scene.stop(); this.scene.get('GameScene').scene.restart({ level: this.faseAtual }); });

    this.modalBg = this.add.rectangle(w/2, h/2, w*2, h*2, 0x000000, 0.85).setVisible(false);
    this.modalBox = this.add.rectangle(w/2, h/2, 600, 300, 0x111111, 1).setStrokeStyle(4, 0x34495e).setVisible(false);
    this.statusTexto = this.add.text(w / 2, h / 2 - 40, '', { fontFamily: 'Impact', fontSize: '64px', color: '#ffffff', letterSpacing: 2 }).setOrigin(0.5).setVisible(false);
    this.botaoAcaoCentralBg = this.add.rectangle(w/2, h/2 + 70, 350, 60, 0x000, 0.8).setStrokeStyle(3, 0xe74c3c).setInteractive({ useHandCursor: true }).setVisible(false);
    this.botaoAcaoCentralTxt = this.add.text(w/2, h/2 + 70, '', { fontFamily: 'Verdana', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);

    this.scale.on('resize', this.redimensionar, this);

    // ==========================================
    // 📱 CONTROLES MOBILE (BOTÕES NA TELA)
    // ==========================================
    // Configura o Phaser para aceitar mais de um toque simultâneo (multitouch)
    this.input.addPointer(2);

    // Botão de Freio/Ré (Esquerda Inferior) com seta
    const btnFreioBg = this.add.circle(80, h - 80, 60, 0xe74c3c, 0.5).setInteractive();
    const txtFreio = this.add.text(80, h - 80, '←', { fontSize: '50px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    
    btnFreioBg.on('pointerdown', () => { this.isFreando = true; btnFreioBg.setAlpha(0.9); if(audioCtx.state === 'suspended') audioCtx.resume(); });
    btnFreioBg.on('pointerup', () => { this.isFreando = false; btnFreioBg.setAlpha(0.5); });
    btnFreioBg.on('pointerout', () => { this.isFreando = false; btnFreioBg.setAlpha(0.5); });

    // Botão de Acelerar (Direita Inferior) com seta
    const btnAcelerarBg = this.add.circle(w - 80, h - 80, 60, 0x2ecc71, 0.5).setInteractive();
    const txtAcelerar = this.add.text(w - 80, h - 80, '→', { fontSize: '50px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    btnAcelerarBg.on('pointerdown', () => { this.isAcelerando = true; btnAcelerarBg.setAlpha(0.9); if(audioCtx.state === 'suspended') audioCtx.resume(); });
    btnAcelerarBg.on('pointerup', () => { this.isAcelerando = false; btnAcelerarBg.setAlpha(0.5); });
    btnAcelerarBg.on('pointerout', () => { this.isAcelerando = false; btnAcelerarBg.setAlpha(0.5); });

    // ==========================================
    // ⌨️ ATALHOS DE TECLADO (HOTKEYS)
    // ==========================================
    
    // Pressione 'R' para Reiniciar a fase
    this.input.keyboard!.on('keydown-R', () => {
      SoundFX.pararMotor(); 
      this.scene.stop(); 
      this.scene.get('GameScene').scene.restart({ level: this.faseAtual });
    });

    // Pressione 'ESC' para voltar ao Menu Inicial
    this.input.keyboard!.on('keydown-ESC', () => {
      SoundFX.pararMotor(); 
      this.scene.get('GameScene').scene.stop(); 
      this.scene.start('MenuScene'); 
    });
    
  }

  redimensionar(gameSize: Phaser.Structs.Size) {
    const w = gameSize.width; const h = gameSize.height;
    this.hudBar.setSize(w * 2, 70); this.progressoLinhaBg.setSize(w - 300, 6); this.progressoBandeira.setPosition(w - 270, 20);
    this.botaoMenuHUD.setPosition(w - 20, 35); this.botaoReiniciarHUD.setPosition(w - 130, 35);
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
    this.botaoAcaoCentralBg.off('pointerover').on('pointerover', () => this.botaoAcaoCentralBg.setFillStyle(corBotao, 0.3));
    this.botaoAcaoCentralBg.off('pointerout').on('pointerout', () => this.botaoAcaoCentralBg.setFillStyle(0x000, 0.8));
    this.botaoAcaoCentralBg.off('pointerdown').on('pointerdown', acaoBotao as Function);
  }
  marcarCargaPerdida() { this.cargasTexto.setText('📦 SEGURAS: FALHA').setColor('#e74c3c'); }
}

// ==========================================
// CENA 4: O JOGO
// ==========================================
class GameScene extends Phaser.Scene {
  mundoFisico!: planck.World; 
  chassiBody!: planck.Body; rodaTrasBody!: planck.Body; rodaFrenteBody!: planck.Body; molaTras!: planck.WheelJoint; molaFrente!: planck.WheelJoint;
  cargasBodies: planck.Body[] = []; cargasVisuais: Phaser.GameObjects.Graphics[] = []; moedasBodies: planck.Body[] = []; moedasVisuais: Phaser.GameObjects.Graphics[] = [];
  carroVisual!: Phaser.GameObjects.Graphics; rodaTrasVisual!: Phaser.GameObjects.Graphics; rodaFrenteVisual!: Phaser.GameObjects.Graphics; terrenoVisual!: Phaser.GameObjects.Graphics;
  pedrasSoltasBodies: planck.Body[] = []; pedrasSoltasVisuais: Phaser.GameObjects.Graphics[] = [];

  arvoresVisuais!: Phaser.GameObjects.Graphics;
  poeiraEmitter!: Phaser.GameObjects.Particles.ParticleEmitter; cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  
  isGameOver: boolean = false; faseAtual: number = 1; fimDoMapaX: number = 0; meuCarro!: any; 
  bgGradient!: Phaser.GameObjects.Graphics;
  
  constructor() { super('GameScene'); }

  init(data: any) { this.faseAtual = data.level || 1; this.meuCarro = CATÁLOGO_CARROS.find(c => c.id === gameData.activeCar) || CATÁLOGO_CARROS[0]; }

  create() {
    this.isGameOver = false; this.cargasBodies = []; this.cargasVisuais = []; this.moedasBodies = []; this.moedasVisuais = []; this.pedrasSoltasBodies = []; this.pedrasSoltasVisuais = [];

    this.bgGradient = this.add.graphics().setScrollFactor(0);
    this.atualizarCeu();

    this.mundoFisico = new planck.World(new planck.Vec2(0, 10));

    this.gerarMontanhasParallax();
    
    this.arvoresVisuais = this.add.graphics().setDepth(9);
    this.terrenoVisual = this.add.graphics().setDepth(10);
    
    this.gerarTerrenoBox2D(this.faseAtual);
    this.criarCarroBox2D();
    this.criarCargasBox2D();
    this.criarSistemaDePoeira();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.cameras.main.setZoom(0.7);

    this.scene.launch('HUDScene', { fase: this.faseAtual });
    this.scene.bringToTop('HUDScene');

    SoundFX.iniciarMotor();
    let ultimaBatida = 0;

    this.mundoFisico.on('begin-contact', (contact) => {
      let uA = contact.getFixtureA().getUserData(); let uB = contact.getFixtureB().getUserData();
      let fixA = contact.getFixtureA(); let fixB = contact.getFixtureB();

      if (uA === 'moeda' && (uB === 'chassi' || uB === 'roda')) this.coletarMoeda(fixA.getBody());
      if (uB === 'moeda' && (uA === 'chassi' || uA === 'roda')) this.coletarMoeda(fixB.getBody());
      if (uA === 'chegada' && (uB === 'chassi' || uB === 'roda' || uB === 'carga') || uB === 'chegada' && (uA === 'chassi' || uA === 'roda' || uA === 'carga')) this.vencerJogo();
      
      if ((uA === 'chassi' && (uB === 'ground' || uB === 'ponte' || uB === 'stone')) || (uB === 'chassi' && (uA === 'ground' || uA === 'ponte' || uA === 'stone'))) { 
        if (this.time.now - ultimaBatida > 300) { SoundFX.tocarBatida(); ultimaBatida = this.time.now; }
        if (Math.abs(this.chassiBody.getAngle()) > 1.4) this.perderJogo('CAPOTOU!'); 
      }
      if ((uA === 'carga' && (uB === 'ground' || uB === 'ponte' || uB === 'stone')) || (uB === 'carga' && (uA === 'ground' || uA === 'ponte' || uA === 'stone'))) this.perderJogo('CARGA CAIU!');
    });

    this.scale.on('resize', this.redimensionarCenario, this);
  }

  atualizarCeu() {
    this.bgGradient.clear();
    if (this.faseAtual === 1) this.bgGradient.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xadd8e6, 0xffffff, 1);
    else if (this.faseAtual === 2) this.bgGradient.fillGradientStyle(0x1a252c, 0x1a252c, 0x2c3e50, 0x34495e, 1);
    else if (this.faseAtual === 3) this.bgGradient.fillGradientStyle(0xd35400, 0xd35400, 0xe67e22, 0xf1c40f, 1);
    this.bgGradient.fillRect(-2000, -2000, 9999, 9999);
  }

  gerarMontanhasParallax() {
    const isFase2 = this.faseAtual === 2; const isFase3 = this.faseAtual === 3;
    this.add.circle(200, 100, 80, isFase2 ? 0xecf0f1 : (isFase3 ? 0xf39c12 : 0xfff200), 1).setScrollFactor(0);
    const desenharCamada = (corTopo: number, corBase: number, scroll: number, alturaBase: number, amplitude: number, frequencia: number) => {
      const g = this.add.graphics().setScrollFactor(scroll);
      g.fillGradientStyle(corTopo, corTopo, corBase, corBase, 1);
      g.beginPath(); g.moveTo(-2000, 1500);
      for(let x = -2000; x <= 8000; x += 100) { g.lineTo(x, alturaBase + Math.sin(x * frequencia) * amplitude); }
      g.lineTo(8000, 1500).closePath().fillPath();
    };
    if (this.faseAtual === 1) { desenharCamada(0x2d5a27, 0x1e3f1a, 0.2, 400, 80, 0.002); desenharCamada(0x4a4a4a, 0x2c2c2c, 0.4, 480, 60, 0.004); desenharCamada(0x5d4037, 0x3e2723, 0.6, 550, 30, 0.008); }
    else if (this.faseAtual === 2) { desenharCamada(0x142b11, 0x0a1608, 0.2, 380, 60, 0.003); desenharCamada(0x1e3f1a, 0x0f200d, 0.4, 450, 50, 0.005); desenharCamada(0x2d5a27, 0x1e3f1a, 0.6, 520, 20, 0.009); }
    else { desenharCamada(0x4a2311, 0x2a1309, 0.2, 350, 120, 0.001); desenharCamada(0x5e3319, 0x3a1f0f, 0.4, 420, 100, 0.003); desenharCamada(0x734021, 0x4a2311, 0.6, 500, 60, 0.006); }
  }

  gerarTerrenoBox2D(fase: number) {
    let xAnterior = -200; let yAnterior = 550;
    const tamanhoSegmento = 40; 
    let totalSegmentos = fase === 1 ? 200 : fase === 2 ? 300 : 400;

    const groundBody = this.mundoFisico.createBody();
    
    const linhaBase = this.add.graphics().setDepth(9); const linhaMeio = this.add.graphics().setDepth(10); const linhaTopo = this.add.graphics().setDepth(11);
    
    let cBase = 0x3e2723; let cMeio = 0x1e8449; let cTopo = 0x2ecc71;
    if (fase === 2) { cBase = 0x2c1a16; cMeio = 0x145a32; cTopo = 0x1e8449; }
    if (fase === 3) { cBase = 0x3e2723; cMeio = 0x5d4037; cTopo = 0x8d6e63; }

    linhaBase.fillStyle(cBase); 
    linhaBase.beginPath().moveTo(xAnterior, 1500).lineTo(xAnterior, yAnterior + 12);
    linhaMeio.lineStyle(24, cMeio); 
    linhaMeio.beginPath().moveTo(xAnterior, yAnterior + 12); 
    linhaTopo.lineStyle(8, cTopo); 
    linhaTopo.beginPath().moveTo(xAnterior, yAnterior + 4);

    let i = 0;
    while (i < totalSegmentos) { 
      let xAtual = xAnterior + tamanhoSegmento;
      let yAtual = 550;
      
      let fixedBumps = Math.sin(i * 0.8) * 6; 

      if (i > 10) {
        if (fase === 1) yAtual = 550 + Math.sin(i * 0.1) * 40; 
        else if (fase === 2) yAtual = 550 + Math.sin(i * 0.08) * 120 + Math.sin(i * 0.3) * 20; 
        else yAtual = 550 + Math.sin(i * 0.04) * 110 + Math.sin(i * 0.12) * 30; 
      }

      yAtual += fixedBumps;

      let fazerPonte = (fase >= 2 && i > 30 && i < totalSegmentos - 40 && i % 90 === 0);

      if (fazerPonte) {
        linhaBase.lineTo(xAnterior, 1500).closePath().fillPath();
        linhaMeio.strokePath(); linhaTopo.strokePath();

        const ponteYInicio = yAnterior; let pXAnterior = xAnterior;
        let ancoraAnterior: planck.Body | null = null; let corposPonte: planck.Body[] = [];

        for (let p = 0; p < 12; p++) {
            const tabua = this.mundoFisico.createDynamicBody({ position: new planck.Vec2((pXAnterior + 17.5) * P2M, ponteYInicio * P2M) });
            tabua.createFixture(planck.Box(17.5 * P2M, 2 * P2M), { density: 1.5, friction: 0.8, userData: 'ponte' });
            corposPonte.push(tabua);
            this.add.rectangle(pXAnterior + 17.5, ponteYInicio, 33, 10, 0x8d6e63).setData('body', tabua).setName('visualPonte');

            if (p === 0) this.mundoFisico.createJoint(planck.RevoluteJoint({}, groundBody, tabua, new planck.Vec2(xAnterior * P2M, ponteYInicio * P2M)));
            else this.mundoFisico.createJoint(planck.RevoluteJoint({}, ancoraAnterior!, tabua, new planck.Vec2(pXAnterior * P2M, ponteYInicio * P2M)));
            ancoraAnterior = tabua; pXAnterior += 35;
        }

        xAnterior = pXAnterior; yAnterior = ponteYInicio; xAtual = xAnterior + tamanhoSegmento; yAtual = ponteYInicio; 
        this.mundoFisico.createJoint(planck.RevoluteJoint({}, groundBody, ancoraAnterior!, new planck.Vec2(xAnterior * P2M, yAnterior * P2M)));

        linhaBase.fillStyle(cBase).beginPath().moveTo(xAnterior, 1500).lineTo(xAnterior, yAnterior + 12);
        linhaMeio.beginPath().moveTo(xAnterior, yAnterior + 12); linhaTopo.beginPath().moveTo(xAnterior, yAnterior + 4);
        i += 12; continue; 
      }

      groundBody.createFixture(planck.Edge(new planck.Vec2(xAnterior * P2M, yAnterior * P2M), new planck.Vec2(xAtual * P2M, yAtual * P2M)), { friction: 0.9, userData: 'ground' });
      
      linhaBase.lineTo(xAtual, yAtual + 12);
      linhaMeio.lineTo(xAtual, yAtual + 12);
      linhaTopo.lineTo(xAtual, yAtual + 4);
      
      if (i > 15 && fase !== 3) {
        let chance = fase === 2 ? 0.6 : 0.85; 
        if (Math.random() > chance) desenharPinheiro(this.arvoresVisuais, xAtual, yAtual, 0.7 + Math.random() * 0.5, fase === 2);
      }
      
      if (i > 20 && Math.random() > 0.95) this.criarMoeda(xAnterior, yAnterior - 30);

      if (i > 25 && Math.random() > 0.96) {
          this.criarPedraSolta(xAtual, yAtual - 20);
      }

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
    moedaVis.fillStyle(0xf1c40f).fillCircle(0, 0, 15);
    moedaVis.fillStyle(0xf39c12).fillCircle(0, 0, 10);
    moedaVis.fillStyle(0xffffff).fillCircle(-4, -4, 3); 
    
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
      gameData.moedas++; salvarJogo();
    }
  }

  criarPedraSolta(x: number, y: number) {
      const pedraBody = this.mundoFisico.createDynamicBody(new planck.Vec2(x * P2M, y * P2M));
      pedraBody.createFixture(planck.Circle(12 * P2M), { density: 1.0, friction: 3.0, restitution: 0.1, userData: 'stone' }); 
      this.pedrasSoltasBodies.push(pedraBody);

      const g = this.add.graphics({ x: x, y: y });
      let corBase = 0x5d4037; 
      g.fillStyle(corBase).beginPath().moveTo(-9,-3).lineTo(0,-12).lineTo(12,-6).lineTo(9,6).lineTo(0,12).lineTo(-12,9).closePath().fillPath();
      g.fillStyle(0x3e2723, 0.4).fillCircle(3,-3, 3); 
      g.fillStyle(0x8d6e63, 0.4).fillCircle(-4,-6, 2); 

      this.pedrasSoltasVisuais.push(g);
  }

  criarSistemaDePoeira() {
    this.poeiraEmitter = this.add.particles(0, 0, 'flares', { lifespan: 500, speedX: { min: -100, max: -200 }, speedY: { min: -50, max: 0 }, scale: { start: 1, end: 0 }, alpha: { start: 0.5, end: 0 }, tint: 0x5D4037, blendMode: 'NORMAL', emitting: false });
    if (!this.textures.exists('poeiraPixel')) { const g = this.make.graphics({x:0,y:0}); g.fillStyle(0xffffff).fillCircle(6, 6, 6); g.generateTexture('poeiraPixel', 12, 12); }
    this.poeiraEmitter.setTexture('poeiraPixel');
  }

  criarCarroBox2D() {
    const specs = this.meuCarro; 
    const startX = 50; const startY = 300; 

    const CAT_DEFAULT = 0x0001;
    const CAT_WHEEL = 0x0002;

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

    this.carroVisual = this.add.graphics();
    desenharVisuaisDoCarro(this.carroVisual, specs.id);

    this.rodaTrasVisual = gerarTexturaRoda(this, specs.raioPneu);
    this.rodaFrenteVisual = gerarTexturaRoda(this, specs.raioPneu);
  }

  criarCargasBox2D() {
    const specs = this.meuCarro; const cX = 50 + specs.cargoX; 
    
    const posicoesIniciais = [
      { x: cX - 15, y: 285 }, 
      { x: cX + 15, y: 285 }, 
      { x: cX, y: 260 }
    ];

    const CAT_DEFAULT = 0x0001;
    const CAT_CARGO = 0x0004;

    for(let i = 0; i < 3; i++) {
      const boxBody = this.mundoFisico.createDynamicBody(new planck.Vec2(posicoesIniciais[i].x * P2M, posicoesIniciais[i].y * P2M));
      boxBody.createFixture(planck.Box(12 * P2M, 12 * P2M), { density: 0.5, friction: 0.9, userData: 'carga', filterCategoryBits: CAT_CARGO, filterMaskBits: CAT_DEFAULT | CAT_CARGO });
      this.cargasBodies.push(boxBody);
      
      const g = this.add.graphics();
      g.fillStyle(0xd35400).fillRect(-12, -12, 24, 24); 
      g.lineStyle(2, 0x873600).strokeRect(-12, -12, 24, 24); 
      g.beginPath().moveTo(-12, -12).lineTo(12, 12).strokePath().moveTo(12, -12).lineTo(-12, 12).strokePath(); 
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
        this.scene.stop('HUDScene');
        this.scene.restart({ level: this.faseAtual });
      });
    }
  }

  vencerJogo() {
    if (this.isGameOver) return; this.isGameOver = true;
    SoundFX.pararMotor();
    this.molaTras.setMotorSpeed(0); this.molaFrente.setMotorSpeed(0); this.poeiraEmitter.stop();
    
    const hud = this.scene.get('HUDScene') as HUDScene;
    if(hud) {
      if (this.faseAtual < 3) {
        hud.exibirModal('CONCLUÍDO!', '#2ecc71', 'PRÓXIMA FASE', 0x27ae60, () => { this.scene.stop('HUDScene'); this.scene.start('GameScene', { level: this.faseAtual + 1 }); });
      } else {
        hud.exibirModal('🏆 ZEROU!', '#f1c40f', 'VOLTAR AO MENU', 0xd35400, () => { this.scene.stop('HUDScene'); this.scene.start('MenuScene'); });
      }
    }
  }

  redimensionarCenario(_gameSize: Phaser.Structs.Size) { this.atualizarCeu(); }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;

    this.mundoFisico.step(delta / 1000);

    // SOLUÇÃO: Corta o update no mesmo frame se a física detectou o fim de jogo!
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
    
    this.children.getChildren().forEach(child => {
      if (child.name === 'visualPonte') {
        const corpo = child.getData('body') as planck.Body;
        (child as Phaser.GameObjects.Rectangle).setPosition(corpo.getPosition().x * M2P, corpo.getPosition().y * M2P).setRotation(corpo.getAngle());
      }
    });

    this.cameras.main.scrollX = (posChassi.x * M2P) - (this.scale.width / 2) + 200; 
    this.cameras.main.scrollY = (posChassi.y * M2P) - (this.scale.height / 2) + 100;

    if (posChassi.y * M2P > 1200) { this.perderJogo('CAIU NO ABISMO!'); return; }

    let porcentagem = (posChassi.x * M2P - 200) / (this.fimDoMapaX - 200);
    const distReal = Math.max(0, Math.floor((posChassi.x * M2P - 200) / 50));
    
    const hud = this.scene.get('HUDScene') as HUDScene;
    if(hud && hud.atualizarDados) hud.atualizarDados(distReal, gameData.moedas, Phaser.Math.Clamp(porcentagem, 0, 1));

    let noChao = false;
    for (let ce = this.rodaTrasBody.getContactList(); ce; ce = ce.next) { if (ce.contact.isTouching() && (ce.contact.getFixtureA().getUserData() === 'ground' || ce.contact.getFixtureA().getUserData() === 'ponte' || ce.contact.getFixtureA().getUserData() === 'stone' || ce.contact.getFixtureB().getUserData() === 'ground' || ce.contact.getFixtureB().getUserData() === 'ponte' || ce.contact.getFixtureB().getUserData() === 'stone')) noChao = true; }
    for (let ce = this.rodaFrenteBody.getContactList(); ce; ce = ce.next) { if (ce.contact.isTouching() && (ce.contact.getFixtureA().getUserData() === 'ground' || ce.contact.getFixtureA().getUserData() === 'ponte' || ce.contact.getFixtureA().getUserData() === 'stone' || ce.contact.getFixtureB().getUserData() === 'ground' || ce.contact.getFixtureB().getUserData() === 'ponte' || ce.contact.getFixtureB().getUserData() === 'stone')) noChao = true; }

    // ==========================================
    // NOVA LÓGICA DE CONTROLES (PC + MOBILE)
    // ==========================================
    // Puxa as informações da HUDScene para saber se o dedo está na tela
    const hudMobile = this.scene.get('HUDScene') as any;
    const mobileAcelerando = hudMobile && hudMobile.isAcelerando;
    const mobileFreando = hudMobile && hudMobile.isFreando;

    const velocidadeRad = Math.PI * 12; 
    const forcaInclinar = noChao ? 0.5 : 3.5; 

    // O áudio liga se apertar o teclado OU os botões da tela
    SoundFX.atualizarMotor(this.cursors.right.isDown || this.cursors.left.isDown || mobileAcelerando || mobileFreando, !noChao);

    // Se apertar a seta pra direita OU o botão mobile da direita
    if (this.cursors.right.isDown || mobileAcelerando) {
      this.molaTras.setMotorSpeed(velocidadeRad); this.molaFrente.setMotorSpeed(velocidadeRad);
      this.chassiBody.applyAngularImpulse(-forcaInclinar, true); 
      if (noChao) { this.poeiraEmitter.start(); this.poeiraEmitter.setPosition(posRT.x * M2P, posRT.y * M2P + 20); } else { this.poeiraEmitter.stop(); }
    } 
    // Se apertar a seta pra esquerda OU o botão mobile da esquerda
    else if (this.cursors.left.isDown || mobileFreando) {
      this.molaTras.setMotorSpeed(-velocidadeRad); this.molaFrente.setMotorSpeed(-velocidadeRad);
      this.chassiBody.applyAngularImpulse(forcaInclinar, true); this.poeiraEmitter.stop();
    } 
    // Se não apertar nada
    else {
      this.molaTras.setMotorSpeed(0); this.molaFrente.setMotorSpeed(0); this.poeiraEmitter.stop();
    }
  }
}

const config: Phaser.Types.Core.GameConfig = { 
  type: Phaser.AUTO, 
  scale: { mode: Phaser.Scale.RESIZE, parent: document.body, width: '100%', height: '100%' }, 
  scene: [MenuScene, ShopScene, GameScene, HUDScene] 
};

new Phaser.Game(config);
import * as Phaser from 'phaser';
import * as planck from 'planck';

// ============================================================
// CONFIGURAÇÕES TÉCNICAS RÚSTICAS (Padrão Alfa)
// ============================================================
const P2M = 1 / 30; // Pixel para Metro
const M2P = 30;     // Metro para Pixel

// Configurações de Física de Teste (Feio e Funcional)
const CARRO_TESTE = {
  torque: 100,       // Forte para testar subidas
  pesoChassi: 5.0,   // Pesado
  raioRoda: 20,      // Roda pequena cinza
  durezaMola: 3.0    // Mola mole
};

// ============================================================
// CENA ÚNICA DE PROTÓTIPO (Simulação Pura)
// ============================================================
class AlphaPrototypeScene extends Phaser.Scene {
  mundoFisico!: planck.World;
  
  // Corpos Físicos
  chassiBody!: planck.Body;
  rodaTrasBody!: planck.Body;
  rodaFrenteBody!: planck.Body;
  molaTras!: planck.WheelJoint;
  molaFrente!: planck.WheelJoint;
  cargasBodies: planck.Body[] = [];
  
  // Visuais Rústicos (Apenas Geometria)
  carroGraphics!: Phaser.GameObjects.Graphics;
  rodaTrasGraphics!: Phaser.GameObjects.Graphics;
  rodaFrenteGraphics!: Phaser.GameObjects.Graphics;
  terrenoGraphics!: Phaser.GameObjects.Graphics;
  cargasGraphics: Phaser.GameObjects.Graphics[] = [];
  
  // Lógica
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  gameOver: boolean = false;
  textoStatus!: Phaser.GameObjects.Text;

  constructor() { super('AlphaPrototypeScene'); }

  create() {
    this.gameOver = false;
    this.cargasBodies = [];
    this.cargasGraphics = [];

    // Texto de Status Rústico no topo
    this.textoStatus = this.add.text(20, 20, 'ALFA PROTOCOLO: Use SETAS para mover. Proteja o quadrado vermelho.', { 
      fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', backgroundColor: '#000000', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(100);

    // Inicializa Mundo Físico (Gravidade padrão Box2D)
    this.mundoFisico = new planck.World(new planck.Vec2(0, 10));

    // Camadas de desenho
    this.terrenoGraphics = this.add.graphics();
    this.carroGraphics = this.add.graphics();
    this.rodaTrasGraphics = this.add.graphics();
    this.rodaFrenteGraphics = this.add.graphics();

    // 1. Criar Terreno de Teste (Fase fictícia para testes)
    this.criarTerrenoTeste();

    // 2. Criar Carro Box2D (Apenas Físico)
    this.criarCarroFisico();

    // 3. Criar Cargas (Apenas Físico)
    this.criarCargasFisicas();

    // Controles
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // Câmera Rústica (Segue o chassi)
    this.cameras.main.setZoom(0.8);

    // Lógica de Colisão Simples (Win/Loss)
    this.mundoFisico.on('begin-contact', (contact) => {
      let uA = contact.getFixtureA().getUserData();
      let uB = contact.getFixtureB().getUserData();

      // Condição de Derrota: Carga tocou no chão
      if ((uA === 'carga' && uB === 'ground') || (uB === 'carga' && uA === 'ground')) {
        this.finalizarSimulacao('FALHA: Carga Tocou o Chão', '#ff0000');
      }
      // Condição de Derrota: Chassi capotou (ângulo extremo)
      if ((uA === 'chassi' && uB === 'ground') || (uB === 'chassi' && uA === 'ground')) {
        if (Math.abs(this.chassiBody.getAngle()) > 1.4) {
          this.finalizarSimulacao('FALHA: Veículo Capotou', '#ff0000');
        }
      }
      // Condição de Vitória: Chegou no fim do mapa fictício
      if (uA === 'chegada' || uB === 'chegada') {
        this.finalizarSimulacao('SUCESSO: Carga Entregue', '#00ff00');
      }
    });
  }

  // Criação de uma fase fictícia rústica para testes
  criarTerrenoTeste() {
    const groundBody = this.mundoFisico.createBody();
    this.terrenoGraphics.lineStyle(4, 0xaaaaaa); // Linha cinza rústica
    this.terrenoGraphics.beginPath();

    let xAnterior = -100;
    let yAnterior = 500;
    this.terrenoGraphics.moveTo(xAnterior, yAnterior);

    // Gera um terreno simples com algumas rampas e buracos
    for (let i = 0; i < 100; i++) {
      let xAtual = xAnterior + 50;
      // Cria irregularidades intencionais para testar a física
      let yAtual = 500 + Math.sin(i * 0.2) * 50; 
      
      // Adiciona um buraco de teste
      if (i > 40 && i < 45) yAtual = 800; 

      // Física Box2D (Edge Shape)
      groundBody.createFixture(planck.Edge(new planck.Vec2(xAnterior * P2M, yAnterior * P2M), new planck.Vec2(xAtual * P2M, yAtual * P2M)), { 
        friction: 0.8, userData: 'ground' 
      });

      // Desenho Visual Rústico
      this.terrenoGraphics.lineTo(xAtual, yAtual);
      xAnterior = xAtual;
      yAnterior = yAtual;
    }
    this.terrenoGraphics.strokePath();

    // Sensor de Chegada Fictício no fim
    const chegadaBody = this.mundoFisico.createBody(new planck.Vec2((xAnterior) * P2M, (yAnterior - 200) * P2M));
    chegadaBody.createFixture(planck.Box(50 * P2M, 400 * P2M), { isSensor: true, userData: 'chegada' });
    this.add.rectangle(xAnterior, yAnterior - 200, 100, 800, 0x00ff00, 0.2); // Área verde de vitória
  }

  criarCarroFisico() {
    const sX = 100; const sY = 300; // Posição inicial de teste

    // FILTROS DE COLISÃO (Único polimento técnico mantido no Alfa)
    // Carga (0x0004) ignora Rodas (0x0002)
    const CAT_DEFAULT = 0x0001;
    const CAT_WHEEL = 0x0002;

    // Chassi: Retângulo azul rústico
    this.chassiBody = this.mundoFisico.createDynamicBody({ position: new planck.Vec2(sX * P2M, sY * P2M), angularDamping: 2.0 });
    this.chassiBody.createFixture(planck.Box(70 * P2M, 15 * P2M), { density: CARRO_TESTE.pesoChassi, userData: 'chassi', filterCategoryBits: CAT_DEFAULT });
    
    this.carroGraphics.fillStyle(0x0000ff, 0.8).fillRect(-70, -15, 140, 30); // Desenho rústico azul
    this.carroGraphics.lineStyle(2, 0xffffff).strokeRect(-70, -15, 140, 30);

    // Rodas: Círculos cinzas rústicos
    // A mola colide com default (chão) mas ignora carga (MaskBits)
    const fdRoda = { density: 1.0, friction: 3.0, restitution: 0.1, userData: 'roda', filterCategoryBits: CAT_WHEEL, filterMaskBits: CAT_DEFAULT };
    const rY = sY + 30; // Altura da roda

    this.rodaTrasBody = this.mundoFisico.createDynamicBody(new planck.Vec2((sX - 50) * P2M, rY * P2M));
    this.rodaTrasBody.createFixture(planck.Circle(CARRO_TESTE.raioRoda * P2M), fdRoda);
    this.rodaTrasGraphics.fillStyle(0x555555).fillCircle(0, 0, CARRO_TESTE.raioRoda).lineStyle(2, 0x000000).strokeCircle(0, 0, CARRO_TESTE.raioRoda);

    this.rodaFrenteBody = this.mundoFisico.createDynamicBody(new planck.Vec2((sX + 50) * P2M, rY * P2M));
    this.rodaFrenteBody.createFixture(planck.Circle(CARRO_TESTE.raioRoda * P2M), fdRoda);
    this.rodaFrenteGraphics.fillStyle(0x555555).fillCircle(0, 0, CARRO_TESTE.raioRoda).lineStyle(2, 0x000000).strokeCircle(0, 0, CARRO_TESTE.raioRoda);

    // Juntas de Mola (Física Core do jogo)
    const eixo = new planck.Vec2(0, 1); 
    this.molaTras = this.mundoFisico.createJoint(planck.WheelJoint({ enableMotor: true, maxMotorTorque: CARRO_TESTE.torque * 2, motorSpeed: 0.0, frequencyHz: CARRO_TESTE.durezaMola, dampingRatio: 0.7 }, this.chassiBody, this.rodaTrasBody, this.rodaTrasBody.getPosition(), eixo)) as planck.WheelJoint;
    this.molaFrente = this.mundoFisico.createJoint(planck.WheelJoint({ enableMotor: true, maxMotorTorque: CARRO_TESTE.torque * 2, motorSpeed: 0.0, frequencyHz: CARRO_TESTE.durezaMola, dampingRatio: 0.7 }, this.chassiBody, this.rodaFrenteBody, this.rodaFrenteBody.getPosition(), eixo)) as planck.WheelJoint;
  }

  criarCargasFisicas() {
    const sX = 100; const sY = 270; // Em cima do chassi

    const CAT_DEFAULT = 0x0001;
    const CAT_CARGO = 0x0004;

    // Duas cargas quadradas rústicas
    for(let i = 0; i < 2; i++) {
      const boxBody = this.mundoFisico.createDynamicBody(new planck.Vec2((sX - 15 + i*30) * P2M, sY * P2M));
      // Filtro: Colide com default (chão/chassi) e cargo, NUNCA com rodas.
      boxBody.createFixture(planck.Box(12 * P2M, 12 * P2M), { density: 0.5, friction: 0.9, userData: 'carga', filterCategoryBits: CAT_CARGO, filterMaskBits: CAT_DEFAULT | CAT_CARGO });
      this.cargasBodies.push(boxBody);
      
      const g = this.add.graphics();
      g.fillStyle(0xff0000, 0.8).fillRect(-12, -12, 24, 24).lineStyle(2, 0xffffff).strokeRect(-12, -12, 24, 24); // Quadrado vermelho rústico
      this.cargasGraphics.push(g);
    }
  }

  // Finalização Rústica (Sem modais, apenas texto e trava)
  finalizarSimulacao(mensagem: string, cor: string) {
    if (this.gameOver) return;
    this.gameOver = true;
    
    // Para motores
    this.molaTras.setMotorSpeed(0);
    this.molaFrente.setMotorSpeed(0);

    // Texto de fim rústico gigante na tela (Erro do Padding corrigido aqui!)
    this.add.text(this.scale.width/2, this.scale.height/2, mensagem + '\n\n[ Pressione ESPAÇO para reiniciar ]', {
      fontFamily: 'Arial', fontSize: '32px', color: cor, align: 'center', fontStyle: 'bold', backgroundColor: '#000000', padding: { x: 20, y: 20 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Reinício rústico
    this.input.keyboard!.once('keydown-SPACE', () => {
      this.scene.restart();
    });
  }

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    // Avança simulação física
    this.mundoFisico.step(delta / 1000);

    // Atualiza Visuais Rústicos baseados na Física
    
    // Chassi
    const posChassi = this.chassiBody.getPosition();
    this.carroGraphics.setPosition(posChassi.x * M2P, posChassi.y * M2P).setRotation(this.chassiBody.getAngle());
    
    // Rodas
    const posRT = this.rodaTrasBody.getPosition();
    this.rodaTrasGraphics.setPosition(posRT.x * M2P, posRT.y * M2P).setRotation(this.rodaTrasBody.getAngle());
    const posRF = this.rodaFrenteBody.getPosition();
    this.rodaFrenteGraphics.setPosition(posRF.x * M2P, posRF.y * M2P).setRotation(this.rodaFrenteBody.getAngle());

    // Cargas
    for(let i = 0; i < this.cargasBodies.length; i++) {
      const posCarga = this.cargasBodies[i].getPosition();
      this.cargasGraphics[i].setPosition(posCarga.x * M2P, posCarga.y * M2P).setRotation(this.cargasBodies[i].getAngle());
    }

    // Câmera rústica segue o carro
    this.cameras.main.scrollX = (posChassi.x * M2P) - (this.scale.width / 2);
    this.cameras.main.scrollY = (posChassi.y * M2P) - (this.scale.height / 2);

    // Abismo de teste
    if (posChassi.y * M2P > 1000) {
      this.finalizarSimulacao('FALHA: Caiu no Abismo', '#ff0000');
    }

    // ENTRADA DE CONTROLES (Lógica Core)
    const velRad = Math.PI * 10; // Velocidade de rotação de teste
    const forcaInclinar = 1.0;     // Força de teste

    if (this.cursors.right.isDown) {
      this.molaTras.setMotorSpeed(velRad);
      this.molaFrente.setMotorSpeed(velRad);
      this.chassiBody.applyAngularImpulse(-forcaInclinar, true); // Inclina para frente
    } 
    else if (this.cursors.left.isDown) {
      this.molaTras.setMotorSpeed(-velRad);
      this.molaFrente.setMotorSpeed(-velRad);
      this.chassiBody.applyAngularImpulse(forcaInclinar, true); // Inclina para trás
    } 
    else {
      this.molaTras.setMotorSpeed(0);
      this.molaFrente.setMotorSpeed(0);
    }
  }
}

// ============================================================
// CONFIGURAÇÃO DO PHASER RÚSTICA (Sem Fundo Bonito)
// ============================================================
const config: Phaser.Types.Core.GameConfig = { 
  type: Phaser.AUTO, 
  backgroundColor: '#333333', // Fundo cinza escuro de teste
  scale: { mode: Phaser.Scale.RESIZE, parent: document.body, width: '100%', height: '100%' }, 
  scene: [AlphaPrototypeScene] // Apenas a cena do protótipo
};

new Phaser.Game(config);
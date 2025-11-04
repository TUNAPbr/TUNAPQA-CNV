// =====================================================
// COUNTDOWN COMPONENT - Reutilizável e Leve
// =====================================================

/**
 * Componente de countdown simples e eficiente
 * 
 * @example
 * const timer = new CountdownTimer({
 *   duration: 30,
 *   onTick: (timeLeft) => console.log(timeLeft),
 *   onComplete: () => console.log('Fim!'),
 *   onStart: () => console.log('Iniciou!')
 * });
 * 
 * timer.start();
 */
class CountdownTimer {
  /**
   * @param {Object} options - Opções de configuração
   * @param {number} options.duration - Duração em segundos (padrão: 30)
   * @param {Function} options.onTick - Callback chamado a cada segundo
   * @param {Function} options.onComplete - Callback quando countdown termina
   * @param {Function} options.onStart - Callback quando countdown inicia
   */
  constructor(options = {}) {
    this.duration = options.duration || 30;
    this.onTick = options.onTick || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onStart = options.onStart || (() => {});
    
    this.timeLeft = this.duration;
    this.interval = null;
    this.isRunning = false;
    this.isPaused = false;
  }
  
  /**
   * Inicia o countdown
   */
  start() {
    if (this.isRunning) {
      console.warn('Countdown já está rodando');
      return;
    }
    
    this.timeLeft = this.duration;
    this.isRunning = true;
    this.isPaused = false;
    
    // Chamar onStart
    this.onStart();
    
    // Primeiro tick imediatamente
    this.onTick(this.timeLeft);
    
    // Iniciar intervalo
    this.interval = setInterval(() => {
      if (!this.isPaused) {
        this.timeLeft--;
        this.onTick(this.timeLeft);
        
        if (this.timeLeft <= 0) {
          this.stop();
          this.onComplete();
        }
      }
    }, 1000);
  }
  
  /**
   * Para o countdown completamente
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.isPaused = false;
  }
  
  /**
   * Pausa o countdown (pode ser retomado)
   */
  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
  }
  
  /**
   * Retoma o countdown pausado
   */
  resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
  }
  
  /**
   * Reinicia o countdown
   */
  reset() {
    this.stop();
    this.timeLeft = this.duration;
  }
  
  /**
   * Obtém o tempo restante
   * @returns {number} Tempo restante em segundos
   */
  getTimeLeft() {
    return this.timeLeft;
  }
  
  /**
   * Obtém porcentagem de progresso
   * @returns {number} Porcentagem (0-100)
   */
  getProgress() {
    return ((this.duration - this.timeLeft) / this.duration) * 100;
  }
  
  /**
   * Obtém porcentagem restante
   * @returns {number} Porcentagem (0-100)
   */
  getRemaining() {
    return (this.timeLeft / this.duration) * 100;
  }
  
  /**
   * Verifica se está rodando
   * @returns {boolean}
   */
  isActive() {
    return this.isRunning;
  }
  
  /**
   * Formata tempo em MM:SS
   * @param {number} seconds - Segundos para formatar
   * @returns {string} Tempo formatado
   */
  static formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// =====================================================
// HELPER: Criar Countdown Visual (DOM)
// =====================================================

/**
 * Cria elementos DOM para countdown visual
 * @param {string} containerId - ID do container onde inserir
 * @param {Object} options - Opções de estilo
 * @returns {Object} Referências aos elementos criados
 */
function criarCountdownDOM(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} não encontrado`);
    return null;
  }
  
  const style = {
    size: options.size || 'normal', // 'small', 'normal', 'large'
    showBar: options.showBar !== false,
    showText: options.showText !== false,
    className: options.className || ''
  };
  
  // Tamanhos
  const sizes = {
    small: { text: 'text-xl', container: 'w-16 h-16' },
    normal: { text: 'text-3xl', container: 'w-24 h-24' },
    large: { text: 'text-5xl', container: 'w-32 h-32' }
  };
  
  const sizeClasses = sizes[style.size] || sizes.normal;
  
  // HTML
  const html = `
    <div class="countdown-visual ${style.className}">
      ${style.showText ? `
        <div class="text-center mb-4">
          <div class="inline-flex flex-col items-center justify-center ${sizeClasses.container} rounded-full border-4 border-cnv-primary bg-cnv-primary bg-opacity-10">
            <span class="countdown-number ${sizeClasses.text} font-bold text-cnv-primary">--</span>
            <span class="text-xs text-gray-600">seg</span>
          </div>
        </div>
      ` : ''}
      
      ${style.showBar ? `
        <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div class="countdown-bar bg-cnv-primary h-3 rounded-full transition-all duration-1000 ease-linear" style="width: 100%"></div>
        </div>
      ` : ''}
    </div>
  `;
  
  container.innerHTML = html;
  
  return {
    numberElement: container.querySelector('.countdown-number'),
    barElement: container.querySelector('.countdown-bar'),
    container: container.querySelector('.countdown-visual')
  };
}

/**
 * Atualiza o countdown visual
 * @param {Object} elements - Elementos do DOM
 * @param {number} timeLeft - Tempo restante
 * @param {number} percentage - Porcentagem restante (0-100)
 */
function atualizarCountdownDOM(elements, timeLeft, percentage) {
  if (!elements) return;
  
  // Atualizar número
  if (elements.numberElement) {
    elements.numberElement.textContent = timeLeft;
    
    // Efeitos visuais baseados no tempo
    if (timeLeft <= 5) {
      elements.numberElement.classList.add('text-red-600', 'animate-pulse');
      elements.numberElement.classList.remove('text-cnv-primary');
    } else if (timeLeft <= 10) {
      elements.numberElement.classList.add('text-orange-500');
      elements.numberElement.classList.remove('text-cnv-primary');
    } else {
      elements.numberElement.classList.remove('text-red-600', 'text-orange-500', 'animate-pulse');
      elements.numberElement.classList.add('text-cnv-primary');
    }
  }
  
  // Atualizar barra
  if (elements.barElement) {
    elements.barElement.style.width = percentage + '%';
    
    // Cor da barra baseada no tempo
    if (percentage <= 20) {
      elements.barElement.classList.remove('bg-cnv-primary', 'bg-orange-500');
      elements.barElement.classList.add('bg-red-500');
    } else if (percentage <= 50) {
      elements.barElement.classList.remove('bg-cnv-primary', 'bg-red-500');
      elements.barElement.classList.add('bg-orange-500');
    } else {
      elements.barElement.classList.remove('bg-red-500', 'bg-orange-500');
      elements.barElement.classList.add('bg-cnv-primary');
    }
  }
}

// =====================================================
// EXPORTAR
// =====================================================

window.CountdownTimer = CountdownTimer;
window.criarCountdownDOM = criarCountdownDOM;
window.atualizarCountdownDOM = atualizarCountdownDOM;

console.log('✅ Countdown Component carregado');

import { SceneManager } from './core/SceneManager.js'
import { PhysicsWorld } from './physics/PhysicsWorld.js'
import { StemFactory } from './objects/StemFactory.js'
import { FlowerRack } from './objects/FlowerRack.js'
import { FlowerFoam } from './objects/FlowerFoam.js'
import { RibbonSystem } from './systems/RibbonSystem.js'
import { WrappingSystem } from './systems/WrappingSystem.js'
import { InputManager } from './controls/InputManager.js'
import { GameState } from './state/GameState.js'
import { UIManager } from './ui/UIManager.js'
import { PerformanceMonitor } from './utils/PerformanceMonitor.js'
import { CONFIG } from './config.js'

class App {
  constructor() {
    this.container = document.getElementById('canvas-container')
    
    this.sceneManager = new SceneManager(this.container)
    this.physicsWorld = new PhysicsWorld()
    this.gameState = new GameState()
    this.uiManager = new UIManager()
    this.perfMonitor = new PerformanceMonitor()
    
    this.stemFactory = new StemFactory(this.sceneManager, this.physicsWorld)
    this.flowerRack = new FlowerRack(this.sceneManager, this.physicsWorld, this.stemFactory)
    this.flowerFoam = new FlowerFoam(this.sceneManager, this.physicsWorld)
    this.ribbonSystem = new RibbonSystem(this.sceneManager, this.physicsWorld)
    this.wrappingSystem = new WrappingSystem(this.sceneManager)
    
    this.inputManager = new InputManager(
      this.sceneManager,
      this.gameState,
      this.flowerRack,
      this.flowerFoam,
      this.ribbonSystem,
      this.uiManager
    )
    
    this.heldStem = null
    this.insertedStems = []
    
    this._bindEvents()
    this._init()
    this._animate()
  }
  
  _bindEvents() {
    window.addEventListener('resize', () => this._onResize())
    
    this.gameState.on('stageChange', (stage) => {
      this.uiManager.setStage(stage)
      this._onStageChange(stage)
    })
    
    this.gameState.on('progressChange', (progress) => {
      this.uiManager.setProgress(progress)
    })
    
    this.flowerFoam.on('stemInserted', (stem) => {
      this.insertedStems.push(stem)
      this.gameState.addStem()
      this.uiManager.addFeedback('success', `花茎插入成功 (${this.insertedStems.length}/${CONFIG.MAX_STEMS})`)
      
      if (this.insertedStems.length >= CONFIG.MAX_STEMS) {
        this.gameState.setCanBind(true)
        this.uiManager.addFeedback('success', '花茎已全部插好，可以绑扎丝带了')
      }
    })
    
    this.ribbonSystem.on('bindComplete', (result) => {
      this._onBindComplete(result)
    })
    
    this.ribbonSystem.on('bindForceChange', (force) => {
      this.uiManager.setBindForce(force)
    })
    
    this.ribbonSystem.on('stemBreak', (stem) => {
      this.uiManager.addFeedback('danger', '花茎折断了！绑扎过紧')
      this._handleStemBreak(stem)
    })
    
    this.ribbonSystem.on('stemsScatter', () => {
      this.uiManager.addFeedback('warning', '花束散落了！绑扎过松')
      this._handleScatter()
    })
    
    this.uiManager.on('reset', () => this._reset())
    this.uiManager.on('bind', () => this._startBinding())
    this.uiManager.on('wrap', () => this._startWrapping())
    this.uiManager.on('next', () => this._nextStage())
  }
  
  _init() {
    this.flowerRack.createRack()
    this.flowerFoam.createFoam()
    this.gameState.setStage(1)
  }
  
  _onStageChange(stage) {
    const btnBind = document.getElementById('btn-bind')
    const btnWrap = document.getElementById('btn-wrap')
    const btnNext = document.getElementById('btn-next')
    
    switch(stage) {
      case 1:
        btnBind.disabled = !this.gameState.canBind
        btnWrap.disabled = true
        btnNext.disabled = true
        break
      case 2:
        btnBind.disabled = true
        btnWrap.disabled = false
        btnNext.disabled = false
        break
      case 3:
        btnBind.disabled = true
        btnWrap.disabled = true
        btnNext.disabled = true
        this.wrappingSystem.startWrapping(this.insertedStems, () => {
          this.uiManager.addFeedback('success', '包装完成！')
          this.gameState.setProgress(100)
        })
        break
    }
  }
  
  _startBinding() {
    if (this.gameState.stage !== 1) return
    if (this.insertedStems.length < CONFIG.MIN_STEMS_FOR_BIND) {
      this.uiManager.addFeedback('warning', `至少需要 ${CONFIG.MIN_STEMS_FOR_BIND} 支花茎才能绑扎`)
      return
    }
    
    this.gameState.setStage(2)
    this.ribbonSystem.startBinding(this.insertedStems, this.flowerFoam)
  }
  
  _onBindComplete(result) {
    if (result.success) {
      this.uiManager.addFeedback('success', '丝带绑扎完成！')
      this.gameState.setProgress(60)
    }
  }
  
  _handleStemBreak(brokenStem) {
    const idx = this.insertedStems.indexOf(brokenStem)
    if (idx > -1) {
      this.insertedStems.splice(idx, 1)
      this.gameState.removeStem()
    }
    this.gameState.setCanBind(false)
    
    setTimeout(() => {
      if (this.insertedStems.length >= CONFIG.MIN_STEMS_FOR_BIND) {
        this.gameState.setCanBind(true)
      }
    }, 500)
  }
  
  _handleScatter() {
    for (const stem of this.insertedStems) {
      this.flowerFoam.releaseStem(stem)
      stem.body.mass = 0.5
      stem.body.type = 1
      stem.body.wakeUp()
    }
    this.insertedStems = []
    this.gameState.resetStems()
    this.gameState.setCanBind(false)
  }
  
  _startWrapping() {
    if (this.gameState.stage !== 2) return
    this.gameState.setStage(3)
  }
  
  _nextStage() {
    const next = this.gameState.stage + 1
    if (next <= 3) {
      this.gameState.setStage(next)
    }
  }
  
  _reset() {
    for (const stem of this.insertedStems) {
      this.flowerFoam.releaseStem(stem)
      this.stemFactory.removeStem(stem)
    }
    this.insertedStems = []
    
    this.flowerRack.reset()
    this.ribbonSystem.reset()
    this.wrappingSystem.reset()
    this.gameState.reset()
    
    this.uiManager.clearFeedback()
    this.uiManager.addFeedback('success', '已重置')
  }
  
  _onResize() {
    this.sceneManager.onResize()
  }
  
  _animate() {
    requestAnimationFrame(() => this._animate())
    
    const dt = Math.min(1 / 60, this.perfMonitor.getDelta())
    
    this.physicsWorld.step(dt)
    
    if (this.gameState.stage <= 2) {
      this.stemFactory.update()
      this.ribbonSystem.update(dt)
    }
    
    this.wrappingSystem.update(dt)
    this.inputManager.update()
    
    this.sceneManager.render()
    this.perfMonitor.update()
    
    if (this.perfMonitor.shouldScaleDown()) {
      this._scaleDownPerformance()
    }
  }
  
  _scaleDownPerformance() {
    if (this.insertedStems.length > CONFIG.MOBILE_MAX_RIGID_BODIES * 0.7) {
      this.stemFactory.setQuality('low')
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App()
})

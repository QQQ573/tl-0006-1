import * as THREE from 'three'
import { CONFIG } from '../config.js'

export class InputManager {
  constructor(sceneManager, gameState, flowerRack, flowerFoam, ribbonSystem, uiManager) {
    this.sceneManager = sceneManager
    this.gameState = gameState
    this.flowerRack = flowerRack
    this.flowerFoam = flowerFoam
    this.ribbonSystem = ribbonSystem
    this.uiManager = uiManager
    
    this.raycaster = new THREE.Raycaster()
    this.heldStem = null
    this.hoverObject = null
    
    this._lastTapTime = 0
    this._tapCooldown = CONFIG.TAP_COOLDOWN_MS
    
    this._isDragging = false
    this._dragStartPos = new THREE.Vector2()
    this._pinchStartDist = 0
    this._initialScale = 1
    
    this._bindEvents()
  }
  
  _bindEvents() {
    const canvas = this.sceneManager.renderer.domElement
    
    canvas.addEventListener('mousedown', (e) => this._onPointerDown(e))
    canvas.addEventListener('mousemove', (e) => this._onPointerMove(e))
    canvas.addEventListener('mouseup', (e) => this._onPointerUp(e))
    
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false })
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      e.stopPropagation()
    }, { passive: false })
    
    document.addEventListener('keydown', (e) => this._onKeyDown(e))
  }
  
  _onPointerDown(event) {
    if (this.gameState.stage > 2) return
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this._isDragging = true
    this._dragStartPos.copy(mouse)
    
    this._handleTap(mouse)
  }
  
  _onPointerMove(event) {
    if (!this._isDragging) {
      const mouse = this.sceneManager.getMouseFromEvent(event)
      this._updateHover(mouse)
    }
    
    if (this.heldStem) {
      this._updateHeldStemPosition(event)
    }
  }
  
  _onPointerUp(event) {
    this._isDragging = false
    
    if (this.heldStem) {
      this._tryInsertStem(event)
    }
  }
  
  _onTouchStart(event) {
    event.preventDefault()
    
    if (event.touches.length === 1) {
      const mouse = this.sceneManager.getMouseFromEvent(event)
      this._isDragging = true
      this._dragStartPos.copy(mouse)
      this._handleTap(mouse)
    } else if (event.touches.length === 2) {
      this._pinchStartDist = this._getTouchDistance(event.touches)
      this._isPinching = true
    }
  }
  
  _onTouchMove(event) {
    event.preventDefault()
    
    if (event.touches.length === 2 && this._isPinching) {
      return
    }
    
    if (this.heldStem && event.touches.length === 1) {
      this._updateHeldStemPosition(event)
    }
  }
  
  _onTouchEnd(event) {
    event.preventDefault()
    
    if (event.touches.length === 0) {
      this._isDragging = false
      this._isPinching = false
      
      if (this.heldStem) {
        const fakeEvent = { 
          touches: [{ 
            clientX: this._lastTouchX || 0, 
            clientY: this._lastTouchY || 0 
          }] 
        }
        this._tryInsertStem(fakeEvent)
      }
    }
  }
  
  _getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  _handleTap(mouse) {
    const now = Date.now()
    if (now - this._lastTapTime < this._tapCooldown) {
      return
    }
    this._lastTapTime = now
    
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    if (this.gameState.stage === 1 && !this.heldStem) {
      const rackSlots = this.flowerRack.getSlots()
      const intersects = this.raycaster.intersectObjects(rackSlots, true)
      
      if (intersects.length > 0) {
        let slotMesh = null
        for (const hit of intersects) {
          slotMesh = this.flowerRack.getSlotMesh(hit.object)
          if (slotMesh) break
        }
        
        if (slotMesh && slotMesh.userData.occupied) {
          const stem = this.flowerRack.pickStem(slotMesh)
          if (stem) {
            this.heldStem = stem
            this.uiManager.addFeedback('success', '已拿起花茎，点击花泥插入')
          }
        }
      }
    }
  }
  
  _updateHover(mouse) {
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    const rackSlots = this.flowerRack.getSlots()
    const allObjects = [...rackSlots]
    
    if (this.flowerFoam.foamMesh) {
      allObjects.push(this.flowerFoam.foamMesh)
    }
    
    const intersects = this.raycaster.intersectObjects(allObjects, true)
    
    if (this.hoverObject) {
      this._setHoverEffect(this.hoverObject, false)
      this.hoverObject = null
    }
    
    if (intersects.length > 0) {
      let obj = intersects[0].object
      while (obj && !obj.userData?.type) {
        obj = obj.parent
      }
      if (obj?.userData?.type) {
        this.hoverObject = obj
        this._setHoverEffect(obj, true)
      }
    }
    
    document.body.style.cursor = this.hoverObject || this.heldStem ? 'pointer' : 'grab'
  }
  
  _setHoverEffect(obj, hovered) {
    if (obj.userData.type === 'rackSlot' || obj.userData.type === 'flowerFoam') {
      if (obj.material && obj.material.emissive) {
        obj.material.emissive.setHex(hovered ? 0x333300 : 0x000000)
      }
    }
  }
  
  _updateHeldStemPosition(event) {
    if (!this.heldStem) return
    
    if (event.touches && event.touches[0]) {
      this._lastTouchX = event.touches[0].clientX
      this._lastTouchY = event.touches[0].clientY
    }
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    const targetY = CONFIG.STEM_HEIGHT / 2 + 0.5
    const planeNormal = new THREE.Vector3(0, 1, 0)
    const planePoint = new THREE.Vector3(0, targetY, 0)
    const plane = new THREE.Plane(planeNormal, -planePoint.dot(planeNormal))
    
    const intersectPoint = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(plane, intersectPoint)
    
    if (intersectPoint) {
      this.heldStem.body.position.set(
        intersectPoint.x,
        intersectPoint.y + CONFIG.STEM_HEIGHT / 2 - 0.5,
        intersectPoint.z
      )
      this.heldStem.body.velocity.set(0, 0, 0)
      this.heldStem.body.angularVelocity.set(0, 0, 0)
    }
  }
  
  _tryInsertStem(event) {
    if (!this.heldStem) return
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    if (this.flowerFoam.foamMesh) {
      const intersects = this.raycaster.intersectObject(this.flowerFoam.foamMesh, true)
      
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point
        
        if (this.flowerFoam.tryInsert(this.heldStem, hitPoint)) {
          this.heldStem = null
          return
        }
      }
    }
    
    this.heldStem.setHeld(false)
    this.heldStem = null
    this.uiManager.addFeedback('warning', '花茎已放下')
  }
  
  _onKeyDown(e) {
    if (this.gameState.stage === 2) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.ribbonSystem.adjustForce(1)
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.ribbonSystem.adjustForce(-1)
      }
    }
    
    if (e.key === 'r' || e.key === 'R') {
      this.uiManager._emit('reset')
    }
  }
  
  update() {
    if (this.heldStem) {
      this.heldStem.update()
    }
  }
}

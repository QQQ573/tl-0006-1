import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export class SceneManager {
  constructor(container) {
    this.container = container
    
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 30)
    
    this._setupCamera()
    this._setupRenderer()
    this._setupLights()
    this._setupControls()
    this._setupGround()
    
    this.onResize()
  }
  
  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    this.camera.position.set(4, 3, 5)
    this.camera.lookAt(0, 1, 0)
  }
  
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    
    this.container.appendChild(this.renderer.domElement)
  }
  
  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambient)
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(5, 10, 7)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 30
    dirLight.shadow.camera.left = -5
    dirLight.shadow.camera.right = 5
    dirLight.shadow.camera.top = 5
    dirLight.shadow.camera.bottom = -5
    dirLight.shadow.bias = -0.0001
    this.scene.add(dirLight)
    this.dirLight = dirLight
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-5, 3, -3)
    this.scene.add(fillLight)
  }
  
  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 2
    this.controls.maxDistance = 12
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1
    this.controls.target.set(0, 1, 0)
    this.controls.enablePan = false
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_ROTATE
    }
  }
  
  _setupGround() {
    const groundGeo = new THREE.CircleGeometry(10, 32)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a4a,
      roughness: 0.9,
      metalness: 0.1
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    
    const gridHelper = new THREE.GridHelper(10, 20, 0x444466, 0x333355)
    gridHelper.position.y = 0.01
    this.scene.add(gridHelper)
  }
  
  onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    
    this.renderer.setSize(w, h)
  }
  
  render() {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
  
  getRaycaster() {
    return new THREE.Raycaster()
  }
  
  getMouseFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2()
    
    if (event.touches && event.touches.length > 0) {
      mouse.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1
    } else {
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    return mouse
  }
}

import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controls, water, sun;

const loader = new GLTFLoader();

class Boat{
    constructor(){
       loader.load("../assets/ship.glb", (gltf) => {
            scene.add(gltf.scene);
            gltf.scene.scale.set(3, 3, 3);
            gltf.scene.position.z = 30;
            gltf.scene.rotation.y = -3;
            

            this.boat = gltf.scene;
            this.speed = {
                vel: 0,
                rotation: 0
            }
        }) 
    }

    update(){
        if(this.boat){
            this.boat.position.y += this.speed.rotation;
            this.boat.translateX(this.speed.vel);
        }
    }

    stopBoat(){
        this.speed.vel = 0;
        this.speed.rotation = 0;
    }

    positionX(){
        return this.boat.position.x;
    }
}
const boat = new Boat();

class Game2{

    OBSTACLE_PREFAB = new THREE.BoxBufferGeometry(1, 1, 1);
    OBSTACLE_MATERIAL = new THREE.MeshBasicMaterial({color: 0xccdeee});
    BONUS_PREFAB = new THREE.SphereBufferGeometry(1, 12, 12);
    COLLISION_THRESHOLD = 0.2;

    constructor(){
        
        this.divHealth = document.getElementById('health');
        this.divDistance= document.getElementById('distance');
        this.divScore = document.getElementById('score');

        this.divGameOverPanel = document.getElementById('game-over-panel');
        this.divGameOverScore = document.getElementById('game-over-score');
        this.divGameOverDistance = document.getElementById('game-over-distance');

        document.getElementById('start-button').onclick = () =>{
            this.running = true;
            document.getElementById('intro-panel').style.display = 'none';
        };

        document.getElementById('replay-button').onclick = () =>{
            this.running = true;
            this.divGameOverPanel.style.display = 'none';
        };

        this.reset(false);
    }

    reset(replay){
        this.running = false;

        this.speedZ = 50;

        this.time = 0;
        this.clock = new THREE.Clock(); 

        this.health = 100;
        this.score = 0;

        this.cameraLerp = null;
        
        this.divScore.innerText = this.score;
        this.divDistance.innerText = 0;
        this.divHealth.value = this.health;

        this.initializeScene(replay);
    }

    update(){
        if(!this.running) return;

        const timeDelta = this.clock.getDelta();
        this.time += timeDelta;

        if(this.cameraLerp !== null)
            this.cameraLerp.update(timeDelta);

        this.updateGrid();
        this.checkCollisions();
        this.updateInfoPanel();
    }

    updateGrid(){
        document.addEventListener('click', () => {
            this.speedZ += 0.03;
            this.grid.material.uniforms.speedZ.value = this.speedZ;
        })

        this.grid.material.uniforms.time.value = this.time;
        this.objectsParent.position.z = this.speedZ * this.time;
        
        this.objectsParent.traverse((child) => {
            if(child instanceof THREE.Mesh){
                const childZPos = child.position.z + this.objectsParent.position.z - 60;
                if(childZPos > 0){
                    const params = [child, -boat.positionX() , -this.objectsParent.position.z];
                    if(child.userData.type === 'obstacle'){
                        this.setupObstacles(...params);
                    }
                    else {
                        const price = this.setupBonus(...params);
                        child.userData.price = price;
                    }
                }
            }
        })

    }

    checkCollisions(){
        this.objectsParent.traverse((child) => {
            if(child instanceof THREE.Mesh){
                const childZPos = child.position.z + this.objectsParent.position.z - 60;
                
                const thresholdX = this.COLLISION_THRESHOLD + child.scale.x / 2 ;
                const thresholdZ = this.COLLISION_THRESHOLD - child.scale.z / 2 + 60;
                
                if(childZPos > -thresholdZ && Math.abs(child.position.x - (boat.positionX())) < thresholdX){
                    //COLLISION
                    const params = [child, -boat.positionX() , -this.objectsParent.position.z];
                    if(child.userData.type === 'obstacle'){
                        this.health -= 20;
                        this.divHealth.value = this.health;
                        this.setupObstacles(...params);
                        this.shakeCamera({
                            x: camera.position.x,
                            y: camera.position.y,
                            z: camera.position.z,
                        });
                        if(this.health <= 0)
                            this.gameOver();
                    }
                    else{
                        this.createScorePopUp(child.userData.price);
                        this.score += child.userData.price;
                        this.divScore.innerText = this.score;
                        child.userData.price = this.setupBonus(...params);
                    }
                }
            }
        });
    }

    shakeCamera(initialPosition, remainingShakes = 3){
        const $this = this;
        
        const startPosition = {
            x: camera.position.x, 
            y: camera.position.y, 
            z: camera.position.z,
        };

        const startOffset = {x:0, y:0};
        const endOffset = {
            x: this.randomFloat(-2.6, 2.6),
            y: this.randomFloat(-2.6, 2.6),
        };

        this.cameraLerp = new Lerp(startOffset, endOffset, this.randomFloat(0.1, 0.22))
            .onUpdate((value) => {
                camera.position.set(
                    startPosition.x + value.x,
                    startPosition.y + value.y,
                    startPosition.z
                );
            })
            .onFinish(() => {
                if(remainingShakes > 0)
                    $this.shakeCamera(initialPosition, remainingShakes - 1);
                else{
                    $this.cameraLerp = null;
                    camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
                };
                    
            })
    }

    createScorePopUp(score) {
        const scorePopUp = document.createElement('div');
        scorePopUp.innerText = `+${score}`;
        scorePopUp.className = 'score-popup';
        document.body.appendChild(scorePopUp);
        setTimeout(() => {
            scorePopUp.remove();
        }, 1000);
    }

    updateInfoPanel(){
        this.divDistance.innerText = this.objectsParent.position.z.toFixed(0);
    }

    gameOver(){
        this.running = false;
        this.divGameOverScore.innerText = this.score;
        this.divGameOverDistance.innerText = this.objectsParent.position.z.toFixed(0);
        setTimeout(() => {
            this.divGameOverPanel.style.display = 'grid';
            this.reset(true);
        }, 1000);
    }

    createGrid(){
        let divisions = 35;
        let gridLimit = 350;
        this.grid = new THREE.GridHelper(gridLimit * 2, divisions, 0xccddee, 0xccddee);

        var moveableZ = [];
        for (let i = 0; i <= divisions; i++) {
          moveableZ.push(1, 1, 0, 0);
        }

        this.grid.geometry.setAttribute('moveableZ', new THREE.BufferAttribute(new Uint8Array(moveableZ), 1));
        
        this.grid.material = new THREE.ShaderMaterial({
          uniforms: {
            speedZ: {
              value: this.speedZ
            },
            gridLimits: {
              value: new THREE.Vector2(-gridLimit, gridLimit)
            },
            time: {
              value: 0
            }
          },
          visible:false,
          vertexShader: `
            uniform float time;
            uniform vec2 gridLimits;
            uniform float speedZ;
            attribute float moveableZ;

            varying vec3 vColor;

            void main() {
              float limLen = gridLimits.y - gridLimits.x;
              vec3 pos = position;
              if (floor(moveableZ + 0.5) > 0.5){ // if a point has "moveable" attribute = 1 
                float zDist = speedZ * time;
                float curZPos = mod((pos.z + zDist) - gridLimits.x, limLen) + gridLimits.x;
                pos.z = curZPos;
              } 
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
        
            void main() {
              gl_FragColor = vec4(vColor, 1.);
            }
          `,
          vertexColors: THREE.VertexColors
        });

        scene.add(this.grid);
    }

    spawnObstacles(){
        const obj = new THREE.Mesh(
            this.OBSTACLE_PREFAB,
            this.OBSTACLE_MATERIAL
        );

        this.setupObstacles(obj);
        obj.userData = {type: 'obstacle'};
        this.objectsParent.add(obj);

    }

    setupObstacles(obj, refXPos = 0, refZPos = 0){
        //random scale
        obj.scale.set(
            this.randomFloat(0.5, 20),
            this.randomFloat(0.5, 20),
            this.randomFloat(0.5, 20)
        );

        //random position
        obj.position.set(
            refXPos + this.randomFloat(-100, 100),
            obj.scale.y * 0.5,
            refZPos - 175 - this.randomFloat(0,175)
        );
    }

    spawnBonus(){
        const obj = new THREE.Mesh(
            this.BONUS_PREFAB,
            new THREE.MeshBasicMaterial({color: 0x000000})
        );

        const price = this.setupBonus(obj);
        obj.userData = {type: 'bonus', price};
        this.objectsParent.add(obj);
    }

    setupBonus(obj, refXPos = 0, refZPos = 0){
        const price = this.randomInt(5, 20);
        const ratio = price / 20;

        const size = ratio * 0.5;
        obj.scale.set(3, 3, 3);

        const hue = 0.5 + 0.5 * ratio;
        obj.material.color.setHSL(hue, 1, 0.5);

        //random position
        obj.position.set(
            refXPos + this.randomFloat(-100, 100),
            obj.scale.y * 0.5,
            refZPos - 175 - this.randomFloat(0,175)
        );
        
        return price;
    }

    randomFloat(min, max){
        return Math.random() * (max - min) + min;
    }

    randomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    initializeScene(replay){
        if(!replay){
            this.createGrid();
            camera.position.y = 30;
            camera.position.x = 19;
    
            this.objectsParent = new THREE.Group();
            scene.add(this.objectsParent);
    
            for(let i = 0; i < 10; i++)
                this.spawnObstacles();
            for(let i = 0; i < 10; i++)
                this.spawnBonus();
        } else{
            
            this.objectsParent.traverse((item) => {
                if(item instanceof THREE.Mesh){
                    if(item.userData.type === 'obstacle')
                        this.setupObstacles(item);
                    else
                        item.userData.price = this.setupBonus(item);

                } else {
                    item.position.set(0, 0, 0);
                }
            })
        }
            
    }

}

init();

const gameInst = new Game2();

animate();

function init() {

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild( renderer.domElement );


    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 20000 );
    camera.position.set( 30, 30, 100 );

    sun = new THREE.Vector3();

    // Water
    const waterGeometry = new THREE.PlaneGeometry( 10000, 10000 );

    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load( '../img/waternormals.jpg', function ( texture ) {

                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

            } ),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );

    water.rotation.x = - Math.PI / 2;

    scene.add( water );

    // Skybox
    const sky = new Sky();
    sky.scale.setScalar( 10000 );
    scene.add( sky );

    const skyUniforms = sky.material.uniforms;

    skyUniforms[ 'turbidity' ].value = 10;
    skyUniforms[ 'rayleigh' ].value = 2;
    skyUniforms[ 'mieCoefficient' ].value = 0.005;
    skyUniforms[ 'mieDirectionalG' ].value = 0.8;

    const parameters = {
        elevation: 2,
        azimuth: 180
    };

    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    let renderTarget;

    function updateSun() {

        const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
        const theta = THREE.MathUtils.degToRad( parameters.azimuth );

        sun.setFromSphericalCoords( 1, phi, theta );

        sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
        water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

        if ( renderTarget !== undefined ) renderTarget.dispose();

        renderTarget = pmremGenerator.fromScene( sky );

        scene.environment = renderTarget.texture;

    }

    updateSun();


    controls = new OrbitControls( camera, renderer.domElement );
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set( 0, 10, 0 );
    controls.minDistance = 40.0;
    controls.maxDistance = 200.0;
    controls.update();


    const waterUniforms = water.material.uniforms;


    window.addEventListener('resize', onWindowResize);

    //Keyboard events
    window.addEventListener('keydown', function(e){
        if(e.key == 'ArrowRight'){
            boat.speed.vel = -0.7;
        }
        else if(e.key == 'ArrowLeft'){
            boat.speed.vel = +0.7;
        }
    })
    window.addEventListener('keyup', function(e){
        boat.stopBoat();
    })
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
    requestAnimationFrame( animate );
    render();
    boat.update();
    gameInst.update();
}

function render() {

    water.material.uniforms[ 'time' ].value += 1.0 / 60.0;

    renderer.render( scene, camera );

}
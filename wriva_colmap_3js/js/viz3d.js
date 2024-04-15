
import * as THREE from 'three';

import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let perspectiveCamera, controls, scene, renderer, stats;

var manager = new THREE.LoadingManager();

const gui = new GUI({autoPlace: true });

// world
scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
perspectiveCamera = new THREE.PerspectiveCamera( 60, aspect, 1, 1000 );

// Point clouds
var pointcloud;

init();
animate();


function cylinderMesh(pointX, pointY, material) {
    // edge from X to Y
    var direction = new THREE.Vector3().subVectors(pointY, pointX);
    // Make the geometry (of "direction" length)
    var geometry = new THREE.CylinderGeometry(0.06, 0.06, direction.length(), 6, 4, true);
    // shift it so one end rests on the origin
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
    // rotate it the right way for lookAt to work
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
    // Make a mesh with the geometry
    var mesh = new THREE.Mesh(geometry, material);
    // Position it where we want
    mesh.position.copy(pointX);
    // And make it point to where we want
    mesh.lookAt(pointY);
 
    return mesh;
 }


 function parseCOLMAP(fileContent) {
    // Split file content into lines
    const lines = fileContent.split('\n');

    // Initialize arrays to store parsed data
    const images = [];

    // Skip the lines containing #
    while (lines.length > 0 && lines[0].startsWith('#')) {
        lines.shift();
    }

    // Loop through lines but every 2 lines
    for (let i = 0; i < lines.length; i += 2) {
        const line = lines[i];
        const parts = line.trim().split(/\s+/);
        const type = parts.shift(); // Extract the first part as the type

        console.log(parts);

        switch (type) {
            case 'IMAGE_ID':
                // Skip the header line
                break;
            case '#':
                // Ignore comments
                break;
            default:
                // Parse image data
                const image = {
                    id: parseInt(type),
                    qw: parseFloat(parts[0]),
                    qx: parseFloat(parts[1]),
                    qy: parseFloat(parts[2]),
                    qz: parseFloat(parts[3]),
                    tx: parseFloat(parts[4]),
                    ty: parseFloat(parts[5]),
                    tz: parseFloat(parts[6]),
                    cameraId: parseInt(parts[7]),
                    name: parts.slice(8).join(' ')
                };

                // Convert into 4x4 Matrix4
                const C_T_G = new THREE.Matrix4();
                C_T_G.makeRotationFromQuaternion(new THREE.Quaternion(image.qx, image.qy, image.qz, image.qw));
                C_T_G.setPosition(new THREE.Vector3(image.tx, image.ty, image.tz));

                // Make G_T_C using matrixInv.copy
                const G_T_C = new THREE.Matrix4();
                G_T_C.copy(C_T_G).invert();

                // Take the quaternion and translation from G_T_C
                const quaternion = new THREE.Quaternion();
                const position = new THREE.Vector3();

                G_T_C.decompose(position, quaternion, new THREE.Vector3());

                image.qw = quaternion.w;
                image.qx = quaternion.x;
                image.qy = quaternion.y;
                image.qz = quaternion.z;

                image.tx = position.x;
                image.ty = position.y;
                image.tz = position.z;

                images.push(image);
                break;
        }
    }

    //
    console.log(images);

    // Return parsed data
    return { images };
}




function init() {
    


    // world
    scene.background = new THREE.Color( 0xcccccc );
    scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

    // coordinate system helper

    const axesHelper = new THREE.AxesHelper( 5 );
    scene.add( axesHelper );

    // perspective camera
    // perspectiveCamera.position.x = 0;
    // perspectiveCamera.position.y = 100;
    perspectiveCamera.position.z = 20;
    // perspectiveCamera.lookAt(0, -1, 0);


    // Load point cloud
    var ply_fileName = './points3D.ply';
    const plyLoader = new PLYLoader(manager);

    plyLoader.load( ply_fileName, function ( geometry ) {
        const material = new THREE.PointsMaterial( {size: 0.04} );
        material.vertexColors = true;
        pointcloud = new THREE.Points( geometry, material );
        pointcloud.name = 'pointcloud';
        scene.add( pointcloud );

        gui.add( pointcloud.material, 'size', 0.01, 0.2 ).onChange( render ).name('Point Size');
        gui.open();

        render();

    } );

    // Load COLMAP data
    const colmap_fileName = './images.txt';

    const fileLoader = new THREE.FileLoader(manager);
    fileLoader.load( colmap_fileName, function ( fileContent ) {
        const camera_poses = parseCOLMAP(fileContent);
        // Visualize camera poses
        for (const image of camera_poses.images) {
            const camera_scale = 0.15;
            var CURRENT_POSE_OBJECT = new THREE.Object3D();
            var geometry = new THREE.CylinderGeometry( 0.001, 0.71, 2, 4 );
            var material = new THREE.MeshBasicMaterial( {color: 0xD22B2B	 , wireframe:true, wireframeLinewidth: 2} );    
            var pyramid_border = new THREE.Mesh( geometry, material );
            pyramid_border.translateZ(1/2.0);
            pyramid_border.rotation.x = -Math.PI / 2.0;
            pyramid_border.rotation.y = Math.PI / 4.0;
            pyramid_border.scale.multiplyScalar( camera_scale );
            CURRENT_POSE_OBJECT.add( pyramid_border );

            CURRENT_POSE_OBJECT.position.set(image.tx, image.ty, image.tz);
            CURRENT_POSE_OBJECT.quaternion.set(image.qx, image.qy, image.qz, image.qw);
            
            scene.add(CURRENT_POSE_OBJECT);

        }

    }
    );
    


    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    stats = new Stats();
    document.body.appendChild( stats.dom );

    controls = new TrackballControls( perspectiveCamera, renderer.domElement );
    controls.rotateSpeed = 2.0;
    controls.zoomSpeed = 1.5;
    controls.panSpeed = 0.8;

    // controls = new OrbitControls( perspectiveCamera, renderer.domElement );
    // controls.update();


}

function animate() {

    requestAnimationFrame( animate );

    controls.update();

    stats.update();

    render();

}

function render() {
    renderer.render( scene, perspectiveCamera );
}
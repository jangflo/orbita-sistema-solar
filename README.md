# Órbita · Sistema solar en 3D

Un atlas interactivo del Sol y los ocho planetas, con modelos tridimensionales, texturas cartográficas y navegación libre.

**[Abrir la web](https://jangflo.github.io/orbita-sistema-solar/)**

## Explorar

- Arrastra para girar la cámara y usa la rueda o el gesto de pinza para acercarte.
- Selecciona un planeta para verlo de cerca y consultar su ficha.
- Alterna entre perspectiva y vista orbital, y activa u oculta las órbitas y los nombres.
- Controla el tiempo con pausa y cuatro velocidades. A 1×, un segundo representa dos días terrestres.
- Atajos: espacio para pausar; Escape para volver; flechas para cambiar de planeta; H para abrir la ayuda.

Al seleccionar un planeta, el tiempo se pausa para facilitar su observación.

## Ejecutar en tu equipo

No necesita instalación de dependencias ni compilación. Con Python 3, abre una terminal en esta carpeta y ejecuta:

```sh
python3 -m http.server 4317 --bind 127.0.0.1
```

Abre http://127.0.0.1:4317/ en un navegador con WebGL. Los recursos se sirven desde el propio proyecto.

## GitHub Pages

La página se publica desde la rama `main`, carpeta raíz `/`, en Settings → Pages. El archivo `.nojekyll` permite servir los recursos estáticos directamente.

## Sobre la representación

Los ocho planetas conservan su orden alrededor del Sol. Las distancias están comprimidas y los tamaños ampliados para que se puedan explorar. Las posiciones iniciales son una composición didáctica y no una efeméride. Las órbitas usan excentricidades e inclinaciones aproximadas; los periodos orbitales y de rotación mantienen sus proporciones temporales. No se representan todos los satélites ni los anillos tenues de otros gigantes.

## Fuentes y créditos

- Datos astronómicos: [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) y [NASA Science](https://science.nasa.gov/solar-system/planets/).
- Texturas: [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), basadas en imágenes de NASA, bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Algunas zonas se completan artísticamente y los colores se realzan. La iluminación y el color de Neptuno se ajustan para esta visualización.
- Motor 3D: [Three.js](https://threejs.org/), licencia MIT; copia en `vendor/THREE-LICENSE.txt`.
- Tipografía: [Inter](https://rsms.me/inter/), SIL Open Font License; copia en `assets/INTER-LICENSE.txt`.

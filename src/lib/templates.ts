export const templates = [
  {
    id: "social",
    name: "Una historia en 3 escenas",
    label: "Reels · TikTok · Shorts",
    description: "Un gancho que detiene el scroll, una idea clara y un cierre.",
    scenes: [
      {
        title: "El gancho",
        prompt:
          "Plano detalle de una taza de café helado. Un cubo de hielo cae y produce una salpicadura en cámara lenta. Luz de mañana, fondo limpio. Sonido del hielo, sin diálogo. Una sola toma continua.",
      },
      {
        title: "La historia",
        prompt:
          "Una mano prepara un café helado en una cocina luminosa: vierte café sobre hielo y añade leche. Cámara cercana, movimiento suave. Sonidos naturales, sin diálogo ni texto en pantalla.",
      },
      {
        title: "El cierre",
        prompt:
          "El café helado terminado sobre una mesa junto a una ventana. La cámara se acerca lentamente mientras las gotas recorren el vaso. Luz cálida y ambiente tranquilo. Dejar espacio visual arriba para añadir un mensaje después.",
      },
    ],
  },
  {
    id: "product",
    name: "Un producto, todo el foco",
    label: "Demo · Lanzamiento",
    description: "Presenta, muestra el detalle y deja una imagen memorable.",
    scenes: [
      {
        title: "Presentación",
        prompt:
          "Presenta el producto de la imagen de referencia sobre un fondo limpio. La cámara se aproxima lentamente desde un plano general. Iluminación de estudio suave. Conserva su diseño y proporciones. Sin texto ni diálogo.",
      },
      {
        title: "El detalle",
        prompt:
          "Plano macro del producto de referencia: recorre lentamente sus materiales, textura y detalles. Iluminación lateral suave, profundidad de campo corta. Mantén su diseño y proporciones. Sin texto ni diálogo.",
      },
      {
        title: "La última imagen",
        prompt:
          "Plano protagonista del producto de referencia, centrado sobre un fondo sencillo con espacio libre alrededor. Movimiento orbital sutil, iluminación cuidada y sonido ambiental discreto. Sin texto ni diálogo.",
      },
    ],
  },
  {
    id: "loop",
    name: "Un loop para volver a ver",
    label: "Visual · Ambiente",
    description: "Una sola escena. Usa la misma imagen como inicio y final.",
    scenes: [
      {
        title: "El loop",
        prompt:
          "Una escena continua con movimiento suave y cíclico. La composición del final coincide con el inicio para crear un loop. Iluminación constante, cámara fija, sonido ambiental sin diálogo.",
      },
    ],
  },
];

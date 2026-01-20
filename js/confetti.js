const confetti_Stars = () => {
    const defaults = {
    spread: 360,
    ticks: 100,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    shapes: ["star"],
    colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
    };

    function shoot() {
    confetti({
        ...defaults,
        particleCount: 50,
        scalar: 1.2,
        shapes: ["star"],
    });

    confetti({
        ...defaults,
        particleCount: 15,
        scalar: 0.75,
        shapes: ["circle"],
    });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
}

const confetti_Win = (time) => {
    (function frame() {
        confetti({
          count: 3,
          angle: 60,
          spread: 55,
          position: { x: 0 },
        });
      
        confetti({
          count: 3,
          angle: 120,
          spread: 55,
          position: { x: 100 },
        });
      
        if (Date.now() < time) {
          requestAnimationFrame(frame);
        }
      })();
}

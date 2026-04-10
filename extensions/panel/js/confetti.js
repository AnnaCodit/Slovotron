
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

const confetti_win = (endtime) => {
  const interval = setInterval(function () {
    const defaults = { count: 3, spread: 45 };
    const timeLeft = endtime - Date.now();
    if (timeLeft <= 0 || resetTimerPaused) {
      return clearInterval(interval);
    }
    confetti(
      Object.assign({}, defaults, {
        angle: 60,
        position: { x: 10 },
      })
    );
    confetti(
      Object.assign({}, defaults, {
        angle: 120,
        position: { x: 90 },
      })
    );
  }, 25);
}

const confetti_fireworks = (endtime) => {
  const defaults = {
    count: 50,
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0,
  };

  const interval = setInterval(function () {
    const timeLeft = endtime - Date.now();

    if (timeLeft <= 0 || resetTimerPaused) {
      return clearInterval(interval);
    }

    confetti(
      Object.assign({}, defaults, {
        origin: { x: randomInRange(0, 0.3), y: Math.random() - 0.2 },
      })
    );
    confetti(
      Object.assign({}, defaults, {
        origin: { x: randomInRange(0.7, 1), y: Math.random() - 0.2 },
      })
    );
  }, 1000);
}

const confetti_stars = () => {
  const defaults = {
    spread: 360,
    ticks: 80,
    gravity: -0.2,
    decay: 0.94,
    startVelocity: 30,
    shapes: ["star"],
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
  };

  function shoot() {
    confetti(
      Object.assign({}, defaults, {
        count: 50,
        scalar: 1.2,
      })
    );
    confetti(
      Object.assign({}, defaults, {
        count: 15,
        scalar: 0.75,
      })
    );
  }

  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
}

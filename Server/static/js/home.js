const recentRoomList = document.getElementById("recent-room-list");

// Fetches rooms stored in Localstorage and displays them if they still exist
const getRecentRooms = () => {
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  for (var key in recentRooms) {
    const closeTime = 1; // in minutes
    const targetDate = new Date(recentRooms[key][2]);
    targetDate.setMinutes(targetDate.getMinutes() + closeTime);
    const currentDate = new Date();
    const timeRemaining = targetDate.getTime() - currentDate.getTime();
    const minutes = Math.max(
      0,
      Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    );
    const seconds = Math.max(
      0,
      Math.floor((timeRemaining % (1000 * 60)) / 1000)
    );
    // Check if room is expired
    if (minutes == 0 && seconds == 0) {
      continue;
    }
    const minuteString = `${minutes.toLocaleString(undefined, {
      minimumIntegerDigits: 2,
    })}:${seconds.toLocaleString(undefined, {
      minimumIntegerDigits: 2,
    })}`;
    const link = `/join/${key}/${recentRooms[key][0]}/${recentRooms[key][1]}`;
    recentRoomList.innerHTML += `<a class="room-item" href="${link}" >
        <p class="room-item-label">${key}</p>
        <p class="room-item-time" id="${key}-time">${minuteString}</p>
    </a>`;
    setInterval(() => {
      countdown = document.getElementById(`${key}-time`);
      const timeRemaining = targetDate.getTime() - new Date().getTime();
      const minutes = Math.max(
        0,
        Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      );
      const seconds = Math.max(
        0,
        Math.floor((timeRemaining % (1000 * 60)) / 1000)
      );
      // display the countdown
      countdown.innerHTML = `${minutes.toLocaleString(undefined, {
        minimumIntegerDigits: 2,
      })}:${seconds.toLocaleString(undefined, {
        minimumIntegerDigits: 2,
      })}`;
    }, 1000);
  }
  if (recentRoomList.innerHTML == "") {
    recentRoomList.innerHTML = "No rooms found";
  }
};

getRecentRooms();

// When the user clicks on the button, scroll to the top of the document
const scrollToTop = () => {
  document.body.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const scrollToCreate = () => {
  var indicator = document.querySelector(".indicator"),
    joinForm = document.getElementById("join-form"),
    createRoom = document.getElementById("create-room-btn");
  indi = 0;
  indicator.style.marginLeft = indi + "px";
  indicator.style.marginLeft = indi + 50 + "%";
  createRoom.classList.remove("dp-none");
  joinForm.classList.add("dp-none");
  setTimeout(() => {
    document.getElementById("name-input").focus();
  }, 300);
  scrollToTop();
};

const scrollToUsage = () => {
  const navbarHeight = document.querySelector("nav").offsetHeight;
  const targetElement = document.getElementById("usage");
  const targetPosition =
    targetElement.getBoundingClientRect().top + window.scrollY;
  document.body.scrollTo({
    top: targetPosition - navbarHeight,
    behavior: "smooth",
  });
};

const waveBtn = (function () {
  "use strict";
  var btn = document.querySelectorAll(".wave"),
    tab = document.querySelector(".tab-bar"),
    indicator = document.querySelector(".indicator"),
    joinForm = document.getElementById("join-form"),
    createRoom = document.getElementById("create-room-btn"),
    indi = 0;
  indicator.style.marginLeft = indi + "px";

  for (var i = 0; i < btn.length; i++) {
    btn[i].onmousedown = function (e) {
      var newRound = document.createElement("div"),
        x,
        y;

      newRound.className = "cercle";
      this.appendChild(newRound);

      x = e.pageX - this.getBoundingClientRect().left;
      y = e.pageY - this.getBoundingClientRect().top;

      newRound.style.left = x + "px";
      newRound.style.top = y + "px";
      newRound.className += " anim";

      indicator.style.marginLeft = indi + (this.dataset.num - 1) * 50 + "%";

      const tappedJoin = this.dataset.num - 1 == 0;

      if (tappedJoin) {
        joinForm.classList.remove("dp-none");
        createRoom.classList.add("dp-none");
      } else {
        createRoom.classList.remove("dp-none");
        joinForm.classList.add("dp-none");
      }

      setTimeout(function () {
        newRound.remove();
      }, 120000);
    };
  }
})();

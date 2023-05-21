// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Recent Rooms                                                     //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

const recentRoomList = document.getElementById("recent-room-list");

let currentDate = new Date(startDateString);

// Fetches rooms stored in Localstorage and displays them if they still exist
const addRoomList = () => {
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  for (let key in recentRooms) {
    const closeTime = recentRooms[key].closeTime; // in minutes

    const targetDate = new Date(recentRooms[key].timestamp);
    targetDate.setMinutes(targetDate.getMinutes() + closeTime);

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

    const link =
      recentRooms[key].type == "secured"
        ? `/join-secured/${key}/${recentRooms[key].username}/${recentRooms[key].userId}/${recentRooms[key].password}`
        : `/join/${key}/${recentRooms[key].username}/${recentRooms[key].userId}`;
    recentRoomList.insertAdjacentHTML(
      "beforeend",
      `<a class="room-item" href="${link}" >
        <p class="room-item-label">${key}</p>
        <p class="room-item-time" id="${key}-time">${minuteString}</p>
      </a>`
    );
    setInterval(() => {
      const countdown = document.getElementById(`${key}-time`);

      const timeRemaining = targetDate.getTime() - currentDate.getTime();

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

addRoomList();
setInterval(() => currentDate.setSeconds(currentDate.getSeconds() + 1), 1000);

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Inputhandling                                                    //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

const createForm = document.getElementById("create-form");
const joinForm = document.getElementById("join-form");

const nameInput = document.getElementById("name-input");
const roomCodeInput = document.getElementById("code-input");
const roomPasswordInput = document.getElementById("room-password");

let roomTypeSecured = true;
const roomTypeSwitch = document.getElementById("room-type-switch");
const roomTypeLeft = document.getElementById("room-type-left");
const roomTypeRight = document.getElementById("room-type-right");
const roomTypeSwitchIndicator = document.getElementById("switch-indicator");
const typeWarning = document.getElementById("type-warning");

// Make room code uppercase
roomCodeInput.addEventListener("input", (_) => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (nameInput.value == "") {
    return displayError("Please enter a name");
  }
  if (roomTypeSecured && roomPasswordInput.value.length < 4) {
    return displayError(
      "Your room's password must have a length of 5 characters or more"
    );
  }
  if (roomTypeSecured) {
    localStorage.setItem("last_typed_password", roomPasswordInput.value);
    return window.location.replace(
      `/create-secured/${nameInput.value}/${roomPasswordInput.value}`
    );
  }
  window.location.replace(`/create-open/${nameInput.value}`);
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (nameInput.value == "") {
    return displayError("Please enter a name");
  }
  if (roomCodeInput.value == "") {
    return displayError("Please enter a room code");
  }
  window.location.replace(
    `/join/${roomCodeInput.value}/${nameInput.value}/home` // home is set to 'user_id' to specify where this request came from
  );
});

roomTypeSwitch.addEventListener("click", (e) => {
  roomTypeSecured = !roomTypeSecured;
  roomTypeLeft.classList.toggle("switch-item-active");
  roomTypeRight.classList.toggle("switch-item-active");
  roomTypeSwitchIndicator.classList.toggle("switch-indicator-right");
  roomPasswordInput.classList.toggle("dp-none");
  typeWarning.classList.toggle("dp-none");
});

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// UI related functions                                             //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
const errorList = document.getElementById("error-list");

// Main Nav
let indexSelected = 0;
let contentFadeDuration = 0.2;

const homeTopNav = document.getElementById("home-top-nav");

const navLinks = [
  document.getElementById("nav-home"),
  document.getElementById("nav-usage"),
];

const navContents = [
  document.getElementById("home-content"),
  document.getElementById("usage-content"),
];

const navLinePositions = [0, 100, 200, 300];

for (const [i, link] of navLinks.entries()) {
  link.addEventListener("click", (_) => {
    if (indexSelected == i) return;
    navContents[
      indexSelected
    ].style.animation = `content-fade-out ${contentFadeDuration}s ease forwards`;
    setTimeout(() => {
      navContents.forEach((element) => element.classList.add("dp-none"));
      navContents[i].classList.remove("dp-none");
      navContents[
        i
      ].style.animation = `content-fade-in ${contentFadeDuration}s ease forwards`;
    }, contentFadeDuration * 1000);

    navLinks[i].classList.add("nav-link-selected");
    navLinks[indexSelected].classList.remove("nav-link-selected");
    indexSelected = i;
    navLinePositions.forEach((position) =>
      homeTopNav.classList.remove(`nav-line-${position}`)
    );
    homeTopNav.classList.add(`nav-line-${navLinePositions[i]}`);
  });
}

const displayError = (message) => {
  let error = document.createElement("div");
  error.classList.add("error");
  error.innerText = message;
  errorList.appendChild(error);
  setTimeout(() => {
    error.remove();
  }, 4000);
};

// error passed by server
if (error != "") {
  displayError(error);
}

// When the user clicks on the button, scroll to the top of the document
const scrollToTop = () => {
  document.body.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const scrollToCreate = () => {
  let indicator = document.querySelector(".indicator"),
    indi = 0;
  indicator.style.marginLeft = indi + "px";
  indicator.style.marginLeft = indi + 50 + "%";
  createForm.classList.remove("dp-none");
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

const homeTabbarButtons = (() => {
  "use strict";
  let btn = document.querySelectorAll(".wave"),
    indicator = document.querySelector(".indicator"),
    indi = 0;
  indicator.style.marginLeft = indi + "px";
  for (let i = 0; i < btn.length; i++) {
    btn[i].onmousedown = function (e) {
      let newRound = document.createElement("div"),
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
        createForm.classList.add("dp-none");
      } else {
        createForm.classList.remove("dp-none");
        joinForm.classList.add("dp-none");
      }
      setTimeout(function () {
        newRound.remove();
      }, 1200);
    };
  }
})();

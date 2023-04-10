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
  setTimeout(() => {
    document.getElementById("name-input").focus();
  }, 500);
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

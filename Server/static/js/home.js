const recentRoomList = document.getElementById("recent-room-list");

const getRecentRooms = () => {
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  for (var key in recentRooms) {
    const closeTime = 1; // in minutes
    const targetDate = new Date(recentRooms[key][1]);
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
    recentRoomList.innerHTML += `<a class="room-item" href="/join/${key}/${recentRooms[key][0]}">
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

// Room Countdown -> Initially fetches datetime from server and uses that as a time reference

// Datetime room closes at
const targetDate = new Date(targetDateString);
targetDate.setMinutes(targetDate.getMinutes() + closeTime);

// Countdown text element
const countdown = document.getElementById("remaining-time");

// Time fetched from server
let currentDatetime = new Date(startDateString);

// varible for saving datetime temporarily
let tempDateTime = new Date()

const setCountdown = () => {
  const timeRemaining = targetDate.getTime() - currentDatetime.getTime();

  // Calculate minutes and seconds remaining
  const minutes = Math.max(
    0,
    Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  );
  const seconds = Math.max(0, Math.floor((timeRemaining % (1000 * 60)) / 1000));

  // Check if room is expired
  if (closeRoom == "True" && minutes == 0 && seconds == 0) {
    window.location.replace("/");
  }

  // Set text
  countdown.innerHTML = `${minutes.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}:${seconds.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}`;
};

setInterval(setCountdown, 1000);

const increaseCurrentDateTime = () => {
  currentDatetime.setMilliseconds(currentDatetime.getMilliseconds() + (Date.now() - tempDateTime.getTime()))
  tempDateTime = new Date()
  
  // Call self after 1 second
  setTimeout(increaseCurrentDateTime, 1000)
}

increaseCurrentDateTime();
import fetch from 'undici';

async function test() {
  const apiKey = 'AIzaSyDu_rOfLJ5tbb9bjDV-iKg4PeTq4TG5U0I';
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Data:", data);
}

test();

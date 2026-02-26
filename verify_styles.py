from playwright.sync_api import sync_playwright
import time

def verify_leaderboard_styles():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to the local server
        page.goto("http://localhost:8000")

        # Inject some mock data to make the leaderboard and winner visible
        # We need to simulate a state where leaderboard and winner sections are displayed
        page.evaluate("""
            const leaderboard = document.getElementById('leaderboard');
            const winner = document.getElementById('winner');
            const leaderboardList = document.querySelector('#leaderboard .list');
            const winnerName = document.querySelector('#winner .winner-name');

            // Mock leaderboard data
            leaderboardList.innerHTML = `
                <div class="leaderboard-item">
                    <div class="rank">1</div>
                    <div class="name">TestUser1</div>
                    <div class="score">100</div>
                </div>
                <div class="leaderboard-item">
                    <div class="rank">2</div>
                    <div class="name">TestUser2</div>
                    <div class="score">90</div>
                </div>
            `;

            // Mock winner data
            winnerName.textContent = "WinnerUser";

            // Make sections visible
            document.getElementById('leaderboard-statistic').style.display = 'flex';
            winner.style.display = 'block';
        """)

        # Wait a bit for styles to apply and any animations
        time.sleep(1)

        # Screenshot the leaderboard section
        leaderboard_element = page.locator("#leaderboard")
        leaderboard_element.screenshot(path="leaderboard_verification.png")

        # Screenshot the winner section
        winner_element = page.locator("#winner")
        winner_element.screenshot(path="winner_verification.png")

        # Screenshot the whole page to see layout
        page.screenshot(path="full_page_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_leaderboard_styles()

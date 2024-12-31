// ==UserScript==
// @name         Coles Fetch, Display, and Export Shopping Lists (Dynamic Visibility with Delay)
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Extract subscription key, fetch shopping lists, retrieve current prices, display them nicely, and provide export options. Button appears only on /lists pages and dynamically hides on navigation with a delay. Exports all lists on /lists and only the current list on individual list pages based on JSON data.
// @author
// @match        https://www.coles.com.au/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Variable to store the button element
    let exportButton = null;

    // Function to create and style the export button
    function createExportButton() {
        // If the button already exists, do not create another
        if (exportButton) return;

        // Create the button element
        exportButton = document.createElement('button');
        exportButton.innerText = 'Export Shopping Lists';
        exportButton.style.position = 'fixed';
        exportButton.style.bottom = '100px';
        exportButton.style.right = '20px';
        exportButton.style.padding = '10px 7px';
        exportButton.style.backgroundColor = '#e01b23'; // Changed color
        exportButton.style.color = '#fff';
        exportButton.style.border = 'none';
        exportButton.style.borderRadius = '25px';
        exportButton.style.cursor = 'pointer';
        exportButton.style.zIndex = '1000';
        exportButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        exportButton.style.fontSize = '14px';
        exportButton.style.fontWeight = 'bold';
        exportButton.style.transition = 'background-color 0.3s';
        exportButton.style.textTransform = 'uppercase';
        exportButton.style.display = 'none'; // Initially hidden

        // Add hover effect
        exportButton.addEventListener('mouseenter', () => {
            exportButton.style.backgroundColor = '#ec545c'; // Changed hover color
        });
        exportButton.addEventListener('mouseleave', () => {
            exportButton.style.backgroundColor = '#e01b23'; // Revert to original color
        });

        // Append button to the body
        document.body.appendChild(exportButton);

        // Add click event listener
        exportButton.addEventListener('click', fetchShoppingListsAndDisplay);
    }

    // Function to extract and return the subscription key
    function extractSubscriptionKey() {
        try {
            // Locate the <script id="__NEXT_DATA__"> element
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (!nextDataScript) {
                console.error('Unable to find the __NEXT_DATA__ script on the page.');
                alert('Error: __NEXT_DATA__ script not found.');
                return null;
            }

            // Get the content of the script
            const scriptContent = nextDataScript.textContent;
            if (!scriptContent) {
                console.error('__NEXT_DATA__ script is empty.');
                alert('Error: __NEXT_DATA__ script is empty.');
                return null;
            }

            // Use a regular expression to find the BFF_API_SUBSCRIPTION_KEY
            const regex = /"BFF_API_SUBSCRIPTION_KEY"\s*:\s*"([^"]+)"/;
            const match = regex.exec(scriptContent);

            if (match && match[1]) {
                const subscriptionKey = match[1];
                console.log('Extracted BFF_API_SUBSCRIPTION_KEY:', subscriptionKey);
                return subscriptionKey;
            } else {
                console.error('BFF_API_SUBSCRIPTION_KEY not found in __NEXT_DATA__.');
                alert('Error: BFF_API_SUBSCRIPTION_KEY not found.');
                return null;
            }
        } catch (error) {
            console.error('An unexpected error occurred while extracting the subscription key:', error);
            alert(`Error: ${error.message}`);
            return null;
        }
    }

    // Function to extract JSON data from the page
    function extractPageJSON() {
        try {
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (!nextDataScript) {
                console.error('Unable to find the __NEXT_DATA__ script on the page.');
                return null;
            }
            const scriptContent = nextDataScript.textContent;
            if (!scriptContent) {
                console.error('__NEXT_DATA__ script is empty.');
                return null;
            }
            return JSON.parse(scriptContent);
        } catch (error) {
            console.error('Error parsing JSON from __NEXT_DATA__:', error);
            return null;
        }
    }

    // Function to fetch and display shopping lists and their current prices
    async function fetchShoppingListsAndDisplay() {
        try {
            // Disable the button to prevent multiple clicks
            exportButton.disabled = true;
            exportButton.innerText = 'Fetching...';

            // Extract the subscription key
            const subscriptionKey = extractSubscriptionKey();
            if (!subscriptionKey) {
                // Extraction failed; re-enable the button
                exportButton.disabled = false;
                exportButton.innerText = 'Export Shopping Lists';
                return;
            }

            // Extract JSON data from the page
            const pageJSON = extractPageJSON();
            if (!pageJSON) {
                throw new Error('Failed to extract JSON data from the page.');
            }

            // Determine the page context based on JSON data
            let isIndividualListPage = false;
            let currentListId = '';
            let currentListName = '';
            let shoppingLists = [];

            // Navigate the JSON structure to find the current list context
            if (pageJSON.props && pageJSON.props.pageProps) {
                const pageProps = pageJSON.props.pageProps;

                // Check if we're on an individual list page by looking for a single list
                if (pageProps.lists && Array.isArray(pageProps.lists)) {
                    if (pageProps.lists.length === 1) {
                        isIndividualListPage = true;
                        currentListId = pageProps.lists[0].id;
                        currentListName = pageProps.lists[0].name;
                        console.log(`Detected Individual List Page: ${currentListName} (ID: ${currentListId})`);
                    } else if (pageProps.lists.length > 1) {
                        // Multiple lists indicate main /lists page
                        isIndividualListPage = false;
                        console.log('Detected Main /lists Page: Exporting All Lists');
                    }
                }
            }

            // Construct the API URL based on the page context
            let apiUrl = `https://www.coles.com.au/api/bff/lists?type=SHOPPING_LIST&subscription-key=${encodeURIComponent(subscriptionKey)}`;
            console.log('Fetching shopping lists from:', apiUrl);

            // Make the API request
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // Include Authorization header if required by the API
                    // 'Authorization': `Bearer ${subscriptionKey}`
                },
                credentials: 'include' // Include cookies if necessary for authentication
            });

            // Log the HTTP status
            console.log('Shopping Lists API Response Status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to fetch shopping lists. Status: ${response.status}`);
            }

            // Parse the JSON response
            const data = await response.json();
            console.log('Shopping Lists API Response Data:', data);

            // Extract all lists from the API response
            if (data && data.data && Array.isArray(data.data.lists)) {
                shoppingLists = data.data.lists.map(list => ({
                    listId: list.id || 'unknown-id',
                    listName: list.name || 'Unnamed List',
                    items: list.items || []
                }));
            } else if (data && Array.isArray(data.lists)) {
                shoppingLists = data.lists.map(list => ({
                    listId: list.id || 'unknown-id',
                    listName: list.name || 'Unnamed List',
                    items: list.items || []
                }));
            } else if (data && data.payload && data.payload.lists) {
                shoppingLists = data.payload.lists.map(list => ({
                    listId: list.id || 'unknown-id',
                    listName: list.name || 'Unnamed List',
                    items: list.items || []
                }));
            } else {
                console.warn('Unexpected API response structure. Attempting to locate lists dynamically...');
                // Implement a more dynamic search if possible
                const foundLists = findListsInObject(data);
                shoppingLists = foundLists.map(list => ({
                    listId: list.id || 'unknown-id',
                    listName: list.name || 'Unnamed List',
                    items: list.items || []
                }));
            }

            console.log('Extracted Shopping Lists:', shoppingLists);

            if (!shoppingLists || shoppingLists.length === 0) {
                alert('No shopping lists found.');
                exportButton.disabled = false;
                exportButton.innerText = 'Export Shopping Lists';
                return;
            }

            // If on an individual list page, filter the lists to include only the current one
            if (isIndividualListPage && currentListId) {
                shoppingLists = shoppingLists.filter(list => list.listId === currentListId);
                console.log(`Filtered Shopping Lists (Only "${currentListName}"):`, shoppingLists);
            }

            if (!shoppingLists || shoppingLists.length === 0) {
                alert('No matching shopping lists found.');
                exportButton.disabled = false;
                exportButton.innerText = 'Export Shopping Lists';
                return;
            }

            // Iterate through each shopping list and fetch current prices
            const detailedShoppingLists = [];

            for (const list of shoppingLists) {
                const listName = list.listName;
                const listId = list.listId;
                const items = list.items || [];

                console.log(`\n--- Shopping List: ${listName} (ID: ${listId}) ---`);
                console.log(`Number of Items: ${items.length}`);

                const detailedItems = [];

                for (const item of items) {
                    const productId = item.productId;
                    const productName = item.productName;
                    const quantity = item.quantity;

                    if (!productId) {
                        console.warn('Product ID missing for an item. Skipping...');
                        continue;
                    }

                    // Construct the price API URL for the current product
                    const priceApiUrl = `https://data-holdings-fastapi-lp22d.ondigitalocean.app/coles/product_search/${encodeURIComponent(productId)}`;
                    console.log(`Fetching price for Product ID: ${productId} from: ${priceApiUrl}`);

                    try {
                        // Fetch the current price
                        const priceResponse = await fetch(priceApiUrl, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            }
                        });

                        // Log the HTTP status
                        console.log(`Price API Response Status for Product ID ${productId}:`, priceResponse.status);

                        if (!priceResponse.ok) {
                            throw new Error(`Failed to fetch price. Status: ${priceResponse.status}`);
                        }

                        // Parse the JSON response
                        const priceData = await priceResponse.json();
                        const currentPrice = priceData.current_price || 'N/A';

                        // Add the detailed item to the list
                        detailedItems.push({
                            productId,
                            productName,
                            quantity,
                            currentPrice
                        });

                        // Log the product details with current price
                        console.log(`Product ID: ${productId}`);
                        console.log(`Product Name: ${productName}`);
                        console.log(`Quantity: ${quantity}`);
                        console.log(`Current Price (AUD): ${currentPrice}`);
                        console.log('-----------------------------');
                    } catch (priceError) {
                        console.error(`Error fetching price for Product ID ${productId}:`, priceError);
                        detailedItems.push({
                            productId,
                            productName,
                            quantity,
                            currentPrice: 'Error fetching price'
                        });
                        console.log(`Product ID: ${productId}`);
                        console.log(`Product Name: ${productName}`);
                        console.log(`Quantity: ${quantity}`);
                        console.log(`Current Price (AUD): Error fetching price`);
                        console.log('-----------------------------');
                    }
                }

                detailedShoppingLists.push({
                    listId,
                    listName,
                    items: detailedItems
                });
            }

            // Display the shopping lists in a new tab with enhanced design
            displayShoppingLists(detailedShoppingLists);

            alert('Successfully fetched shopping lists and their current prices. Check the new tab for details.');
        } catch (error) {
            console.error('Error fetching shopping lists and prices:', error);
            alert(`Error: ${error.message}`);
            exportButton.disabled = false;
            exportButton.innerText = 'Export Shopping Lists';
        } finally {
            // Re-enable the button
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerText = 'Export Shopping Lists';
            }
        }
    }

    // Recursive function to find 'lists' arrays in nested objects
    function findListsInObject(obj) {
        if (typeof obj !== 'object' || obj === null) return [];
        let found = [];
        if (Array.isArray(obj)) {
            for (const item of obj) {
                found = found.concat(findListsInObject(item));
            }
        } else {
            for (const key in obj) {
                if (key.toLowerCase().includes('list')) {
                    if (Array.isArray(obj[key])) {
                        found = found.concat(obj[key]);
                    } else if (typeof obj[key] === 'object') {
                        found = found.concat(findListsInObject(obj[key]));
                    }
                }
            }
        }
        return found;
    }

    // Function to display shopping lists in a new tab with enhanced design
    function displayShoppingLists(shoppingLists) {
        // Open a new blank tab
        const newTab = window.open('', '_blank');

        if (!newTab) {
            alert('Failed to open a new tab. Please allow pop-ups for this website.');
            return;
        }

        // Generate HTML content with modern design
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Your Coles Shopping Lists</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <!-- Google Fonts -->
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Roboto', sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f4f6f8;
                        color: #333;
                    }
                    h1 {
                        text-align: center;
                        color: #e01b23; /* Changed color to match button */
                        margin-bottom: 40px;
                    }
                    .list {
                        background-color: #fff;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        margin-bottom: 30px;
                        padding: 20px;
                    }
                    .list h2 {
                        color: #e01b23; /* Changed color to match button */
                        margin-bottom: 10px;
                        position: relative;
                        padding-bottom: 10px;
                    }
                    .list h2::after {
                        content: '';
                        position: absolute;
                        left: 0;
                        bottom: 0;
                        width: 50px;
                        height: 3px;
                        background-color: #e01b23; /* Changed color to match button */
                        border-radius: 2px;
                    }
                    .item-details {
                        font-size: 12px;
                        color: #777;
                        margin-bottom: 10px;
                    }
                    .items {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                    }
                    .item-card {
                        background-color: #f9f9f9;
                        border-radius: 6px;
                        padding: 15px;
                        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .item-card:hover {
                        transform: translateY(-5px);
                        background-color: #f0e0e3; /* Changed hover background */
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    }
                    .item-name a { /* Added styling for product links */
                        color: #000000;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    .item-name a:hover {
                        text-decoration: underline;
                    }
                    .item-details {
                        font-size: 14px;
                        margin-bottom: 5px;
                        color: #555;
                    }
                    .price {
                        font-size: 16px;
                        font-weight: 600;
                        color: #28a745;
                        margin-top: 10px;
                    }
                    .export-buttons {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        margin-top: 30px;
                    }
                    .export-buttons button, .export-buttons a {
                        padding: 10px 7px;
                        font-size: 14px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        color: #fff;
                        transition: background-color 0.3s, transform 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .export-buttons button:hover, .export-buttons a:hover {
                        transform: translateY(-3px);
                        opacity: 0.9;
                    }
                    .print-btn {
                        background-color: #28a745;
                    }
                    .email-btn {
                        background-color: #17a2b8;
                    }
                    /* Responsive Design */
                    @media (max-width: 600px) {
                        .export-buttons {
                            flex-direction: column;
                            gap: 10px;
                        }
                        .items {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>Your Coles Shopping Lists</h1>
        `;

        // Iterate through each shopping list and add to HTML
        shoppingLists.forEach(list => {
            htmlContent += `
                <div class="list">
                    <h2>${escapeHtml(list.listName)}</h2>
                    <div class="items">
            `;

            list.items.forEach(item => {
                htmlContent += `
                    <div class="item-card">
                        <div>
                            <div class="item-name"><a href="https://www.coles.com.au/product/${escapeHtml(item.productId)}" target="_blank">${escapeHtml(item.productName)}</a></div>
                            <div class="item-details">Product ID: ${escapeHtml(item.productId)}</div>
                            <div class="item-details">Quantity: ${escapeHtml(item.quantity)}</div>
                        </div>
                        <div class="price">Price: $${escapeHtml(item.currentPrice)}</div>
                    </div>
                `;
            });

            htmlContent += `
                    </div>
                </div>
            `;
        });

        // Add export buttons
        // Prepare email content
        let emailBody = 'Here are my Coles shopping lists:\n\n';
        shoppingLists.forEach(list => {
            emailBody += `Shopping List: ${list.listName}\n`;
            list.items.forEach(item => {
                emailBody += `- ${item.quantity} x ${item.productName} (ID: ${item.productId}) - Price: ${item.currentPrice} AUD\n`;
            });
            emailBody += '\n';
        });

        // Encode email body
        const encodedEmailBody = encodeURIComponent(emailBody);

        htmlContent += `
                <div class="export-buttons">
                    <button class="print-btn" onclick="window.print()">
                        🖨️ Print / Save as PDF
                    </button>
                    <a href="mailto:?subject=My Coles Shopping Lists&body=${encodedEmailBody}" class="email-btn">
                        📧 Send via Email
                    </a>
                </div>
            </body>
            </html>
        `;

        // Write the content to the new tab
        newTab.document.open();
        newTab.document.write(htmlContent);
        newTab.document.close();
    }

    // Function to escape HTML to prevent XSS
    function escapeHtml(text) {
        if (typeof text !== 'string') {
            return text;
        }
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Function to check the current URL and toggle button visibility
    function checkURLAndToggleButton() {
        if (!exportButton) return; // Button not yet created

        const path = window.location.pathname;
        // Check if the path is exactly '/lists' or starts with '/lists/'
        if (path === '/lists' || path.startsWith('/lists/')) {
            exportButton.style.display = 'block';
        } else {
            exportButton.style.display = 'none';
        }
    }

    // Function to initialize the script
    function init() {
        createExportButton();

        // Initial check after a short delay to ensure the DOM is fully loaded
        setTimeout(() => {
            checkURLAndToggleButton();
        }, 500); // 500 milliseconds = 0.5 second

        // Listen for URL changes using the History API
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };

        window.addEventListener('popstate', () => {
            window.dispatchEvent(new Event('locationchange'));
        });

        // Listen for the custom 'locationchange' event
        window.addEventListener('locationchange', () => {
            // Delay execution by 0.5 second after URL change
            setTimeout(() => {
                checkURLAndToggleButton();
            }, 500); // 500 milliseconds = 0.5 second
        });

        // Fallback: Observe changes to the URL using MutationObserver (optional)
        const observer = new MutationObserver(() => {
            // Optional: Additional delay can be added here if needed
            setTimeout(() => {
                checkURLAndToggleButton();
            }, 500);
        });

        observer.observe(document, { subtree: true, childList: true });
    }

    // Initialize the script once the DOM is fully loaded
    window.addEventListener('load', () => {
        init();
    });

})();

var mutationObserver;
var iframeWindow;

const MAX_HEIGHT = 300;
const MAX_WIDTH = 500;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

const processNode = (node) => {
	if (node.tagName === "IMG") {
		// console.log("IMG TAG", node);
		detectFace(node);
		return;
	}

	node?.childNodes?.forEach((child) => processNode(child));
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				// console.log("mutation", mutation.target, mutation.addedNodes);
				mutation.addedNodes.forEach((node) => {
					processNode(node);
				});
			}
		});
	});
};

const isImageTooSmall = (img) => {
	const isSmall = img.width < MIN_WIDTH || img.height < MIN_HEIGHT;
	if (isSmall) {
		img.dataset.isSmall = true;
		return true;
	}
};

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete) {
			img.dataset.complete = true;
			resolve(img);
		} else {
			img.onload = () => {
				img.dataset.onload = true;
				resolve(img);
			};
			img.onerror = (e) => {
				// console.error("Failed to load image", img);
				reject(e);
			};
		}
	});
};

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
// resize image if it's too big

const resizeImageAndReturnData = (img) => {
	try {
		// resize image by keeping aspect ratio and return canvas
		const ratio = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
		canvas.width = img.width * ratio;
		canvas.height = img.height * ratio;
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		return {
			data: imageData.data,
			width: imageData.width,
			height: imageData.height,
			imgSrc: img.src,
		};
	} catch (error) {
		console.log("error resizing image", error, img.src);
	}
};

const sendImageToWorker = (imageData, imgSrc) => {
	// console.log ("image data", imageData)
	try {
		if (!iframeWindow) return;
		iframeWindow.postMessage(
			{
				image: imageData.data.buffer,
				width: imageData.width,
				height: imageData.height,
				imgSrc,
			},
			"*"
		);
	} catch (error) {
		console.log("error sending image to worker", error, imgSrc);
	}
};

const sendImageForProcessing = async (img) => {
	// check if image is loaded, print error if not
	let loadedImage = await loadImage(img);
	if (!loadedImage) {
		// console.error("Failed to load image", img);
		return;
	}
	if (isImageTooSmall(loadedImage)) return;

	// resize image if it's too big
	const imageCanvasData = resizeImageAndReturnData(loadedImage);
	// send image to worker
	sendImageToWorker(imageCanvasData, img.src);
};

const processImageAfterReceive = (detections, img) => {
	if (!detections?.face?.length) {
		console.log("skipping cause no faces", img);
		img.dataset.blurred = false;

		return;
	}

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		console.log("skipping cause not a woman", img);
		img.dataset.blurred = false;
		return;
	}

	console.log("blurring image", img);

	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.1s ease";
	img.style.opacity = "unset";

	img.dataset.blurred = true;
	// console.log("count ", count++);
};

const shouldProcessImage = (img) => {
	if (img.dataset.processed) return false;
	img.dataset.processed = true;
	return true;
};

const detectFace = async (img) => {
	// somehow mark image as processed
	// so that it's not processed again
	try {
		if (!shouldProcessImage(img)) return;

		img.crossOrigin = "anonymous";

		await sendImageForProcessing(img);
	} catch (error) {
		// console.log ("error detecting face", error, img.src)
	}
};

const receiveMessage = (event) => {
	console.log("detections received from worker", event);
	const imgSrc = event.data.imgSrc;
	const images = document.querySelector(`img[src="${imgSrc}"]`);
	if (!images) return;
	for (let img of images) {
		processImageAfterReceive(event.data.detections, img);
	}
};

const init = async () => {
	console.log("INITaa");

	await initMutationObserver();

	const images = document.getElementsByTagName("img");
	// console.log("images", images);

	// const imagesArray = Array.from(images);
	for (let img of images) {
		// console.log("🚀 ~ file: content.js:261 ~ init ~ img:", img);
		detectFace(img);
	}

	mutationObserver.observe(document.body, { childList: true, subtree: true });
};

const initIframe = async () => {
	const iframe = document.createElement("iframe");
	iframe.id = "my-iframe";

	// Set the src attribute to the URL of worker.html.
	iframe.src = chrome.runtime.getURL("src/worker/worker.html");

	// Append the iframe to the DOM.
	document.body.appendChild(iframe);

	// Wait for the iframe to load.
	await new Promise((resolve) => {
		iframe.onload = resolve;
	});

	// Get the iframe's window object.

	iframeWindow = iframe.contentWindow;
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", async () => {
		try {
			await initIframe();
			await init();
		} catch (error) {
			console.error("Error initializing:", error);
		}
	});
} else {
	initIframe()
		.then(init)
		.catch((error) => {
			console.error("Error initializing:", error);
		});
}

// Listen for messages from the worker.
window.addEventListener("message", (event) => {
	console.log("message received from iframe", event);
	// if (event.source !== iframeWindow) return;
	// receiveMessage(event);
});

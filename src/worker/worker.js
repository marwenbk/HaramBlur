importScripts("./human.js");

let human;

const config = {
	// modelBasePath: modelsUrl,
	backend: "cpu",
	modelBasePath: "../assets/models/",
	face: {
		enabled: true,
		modelPath: "blazeface.json",
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { maxDetected: 3 },
		// description: { enabled: true, modelPath: "faceres.json" },
	},

	// disable all other models
	// except face
	// to save resources
	body: {
		enabled: false,
	},
	hand: {
		enabled: false,
	},
	gesture: {
		enabled: false,
	},
	object: {
		enabled: false,
	},
};

self.onmessage = async (msg) => {
	// received from index.js using:
	// worker.postMessage({ image: image.data.buffer,   dth: canvas.width, height: canvas.height, config }, [image.data.buffer]);
	try {
		// Human is registered as global namespace using IIFE script
		if (!human) {
			human = new Human.default(config);
			await human.load(config);
			// await human.warmup();
		}

		console.log("worker received image: ", msg);

		if (msg?.data?.image) {
			const image = new ImageData(
				new Uint8ClampedArray(msg.data.image),
				msg.data.width,
				msg.data.height
			);

			let result = {};
			result = await human.detect(image, config);
            console.log ("result", result)
			postMessage({
				detections: result?.face,
				imgSrc: msg.data.imgSrc,
			});
		}
	} catch (e) {
		console.log("error processing image", e);
	}
};

export class Controller {
  private static instance: Controller;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  public static getInstance(): Controller {
    if (Controller.instance) {
      return Controller.instance;
    }
    Controller.instance= new Controller()
    return Controller.instance;
    // throw new Error("getInstance: no scheduler exists");
  }

  // public static setInstance(newInstance: Controller) {
  //   if (Controller.instance) {
  //     if (Controller.instance.running) {
  //       throw new Error("setInstance: existing scheduler is still running");
  //     }
  //   }
  //   Controller.instance = newInstance;
  // }

  running: boolean = false;

  enable(restart: boolean = false) {
    console.info(`Controller enable, restart=${restart}`);
    this.running = true;
  }

  shutdown() {
    console.info("Controller shutdown");
  }

  initialScheduleComplete() {
    console.info("Controller initialScheduleComplete");
  }

  triggerNotification() {
    console.info("Controller triggerNotification");
  }
}

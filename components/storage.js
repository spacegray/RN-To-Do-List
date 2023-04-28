import AsyncStorage from "@react-native-async-storage/async-storage";

export const addTask = async (task) => {
  try {
    const id = Date.now().toString(); // generate unique id
    const data = JSON.stringify({ ...task, id });
    await AsyncStorage.setItem(id, data);
  } catch (e) {
    console.log("Error saving data:", e);
  }
};

export const updateTask = async (id, updatedTask) => {
  try {
    const data = JSON.stringify(updatedTask);
    await AsyncStorage.setItem(id, data);
  } catch (e) {
    console.log("Error saving data:", e);
  }
};

export const deleteTask = async (id) => {
  try {
    await AsyncStorage.removeItem(id);
  } catch (e) {
    console.log("Error deleting data:", e);
  }
};


export const saveData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
    console.log("Data saved successfully.");
  } catch (error) {
    console.log(error);
     console.log("Error saving data:", error);
  }
};

export const loadData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch (error) {
    console.log(error);
  }
};

export const deleteData = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.log(error);
  }
};


export async function checkAsyncStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const items = await AsyncStorage.multiGet(keys);
    console.log(items);
  } catch (error) {
    console.error(error);
  }
}
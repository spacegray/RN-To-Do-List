import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const App = () => {
  const [task, setTask] = useState("");
  const [suggestedTask, setSuggestedTask] = useState("");
  const tasks = [
    "Do laundry",
    "Clean the kitchen",
    "Take out the trash",
    "Walk the dog",
    "Buy groceries",
    "Call mom",
  ];

  const handleAddTask = () => {
    // Add suggested task if available, else add input task
    const newTask = suggestedTask ? suggestedTask : task;
    // Add task to list of tasks
    setTasks((prevTasks) => [...prevTasks, newTask]);
    // Reset input fields
    setTask("");
    setSuggestedTask("");
  };

  const handleSuggestTask = () => {
    // Pick a random task from the list of tasks
    const randomIndex = Math.floor(Math.random() * tasks.length);
    const randomTask = tasks[randomIndex];
    // Set the suggested task
    setSuggestedTask(randomTask);
  };

  return (
    <View style={styles.container}>
      <View style={styles.taskWrapper}>
        <Text style={styles.sectionTitle}>Add a Task:</Text>
        <TextInput
          style={styles.input}
          placeholder="Write a task"
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity
          style={styles.suggestButton}
          onPress={handleSuggestTask}
        >
          <Text style={styles.buttonText}>Suggest a Task</Text>
        </TouchableOpacity>
        <Text style={styles.suggestedTaskText}>
          {suggestedTask ? `Suggested task: ${suggestedTask}` : ""}
        </Text>
        <TouchableOpacity style={styles.addWrapper} onPress={handleAddTask}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0E6EF",
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  taskWrapper: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: "#FFF",
    borderRadius: 60,
    borderColor: "#C0C0C0",
    borderWidth: 1,
    marginBottom: 20,
  },
  suggestButton: {
    backgroundColor: "#FFA500",
    padding: 10,
    borderRadius: 60,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  suggestedTaskText: {
    marginBottom: 10,
  },
  addWrapper: {
    backgroundColor: "#6495ED",
    padding: 15,
    borderRadius: 60,
    alignItems: "center",
  },
  addText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
  },
});

export default App;

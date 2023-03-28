import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import RandomTaskButton from "./components/RandomTaskButton";

export default function App() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);

  const handleAddTask = () => {
    if (task.length > 0) {
      setTasks([...tasks, task]);
      setTask("");
    }
  };

  const handleCompleteTask = (index) => {
    const task = tasks[index];
    setTasks(tasks.filter((task, i) => i !== index));
    setCompletedTasks([...completedTasks, task]);
  };

  const handleRandomTaskSelected = (selectedTask) => {
    setTask(selectedTask);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tasksWrapper}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <ScrollView style={styles.items}>
            {tasks.map((task, index) => (
              <TouchableOpacity
                key={index}
                style={styles.task}
                onPress={() => handleCompleteTask(index)}
              >
                <Text style={styles.taskText}>{task}</Text>
              </TouchableOpacity>
            ))}
            {tasks.length === 0 && (
              <View style={styles.emptyTasks}>
                <Text style={styles.emptyText}>No tasks to do</Text>
              </View>
            )}
          </ScrollView>
        </View>
        <View style={styles.section}>
          
          <Text style={styles.sectionTitle}>Completed Tasks</Text>
          <ScrollView style={styles.items}>
            {completedTasks.map((task, index) => (
              <TouchableOpacity key={index} style={styles.task}>
                <Text style={styles.taskText}>{task}</Text>
              </TouchableOpacity>
            ))}
            {completedTasks.length === 0 && (
              <View style={styles.emptyTasks}>
                <Text style={styles.emptyText}>No tasks completed</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      <View style={styles.writeTaskWrapper}>
        <TextInput
          style={styles.input}
          placeholder={"Write a task"}
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <RandomTaskButton onRandomTaskSelected={handleRandomTaskSelected} />
        <TouchableOpacity style={styles.addWrapper} onPress={handleAddTask}>
          <Text style={styles.addText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0E6EF",
  },
  tasksWrapper: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  iconsWrapper: {
    flexDirection: "row",
    // alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#6B5B95",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "#333",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  scrollView: {
    marginTop: 20,
    height: "60%",
  },

  items: {
    height: 400,
    overflow: "hidden",
  },
  task: {
    width: "100%",
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "#F3D3BD",
    marginBottom: 10,
    justifyContent: "center",
    paddingLeft: 20,
    shadowColor: "#333",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5,
  },
  taskText: {
    fontSize: 18,
    color: "#6B5B95",
  },
  deleteButton: {
    position: "absolute",
    right: 20,
  },
  deleteText: {
    fontSize: 18,
    color: "#E71D36",
    fontWeight: "bold",
  },
  writeTaskWrapper: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: "#D7DBDD",
    backgroundColor: "#fff",
    shadowColor: "#333",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5,
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: "#FEF8FC",
    borderRadius: 50,
    borderColor: "#C0C0C0",
    borderWidth: 1,
    width: "80%",
    marginRight: 20,
    fontSize: 18,
    color: "#6B5B95",
  },
  addWrapper: {
    width: 55,
    height: 55,
    marginLeft: 20,
    backgroundColor: "#6B5B95",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#333",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5,
  },
  addText: {
    fontSize: 36,
    color: "#FEF8FC",
  },
  emptyTasks: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 24,
    color: "#6B5B95",
    textAlign: "center",
  },
});

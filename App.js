import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Task from "./components/Task";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [task, setTask] = useState("");

  const handleAddTask = () => {
    if (task.length > 0) {
      setTasks([...tasks, { id: Date.now(), text: task }]);
      setTask("");
    }
  };

  const editTask = (taskId, taskText) => {
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, text: taskText };
      }
      return task;
    });
    setTasks(updatedTasks);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId) => {
    const remainingTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(remainingTasks);
    setSelectedTasks([]);
  };

  const handleCompleteTask = (taskId) => {
    const completedTask = tasks.find((task) => task.id === taskId);
    setCompletedTasks([...completedTasks, completedTask]);
    const remainingTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(remainingTasks);
    setSelectedTasks([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tasksWrapper}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <ScrollView style={styles.items}>
            {tasks.map((task) => (
              <Task
                key={task.id}
                task={task}
                handleDeleteTask={handleDeleteTask}
                editTask={editTask}
                handleCompleteTask={handleCompleteTask}
                selectedTasks={selectedTasks}
                editingTask={editingTask}
                setEditingTask={setEditingTask}
                text={task.text}
              />
            ))}
          </ScrollView>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Tasks</Text>
          <ScrollView style={styles.items}>
            {completedTasks.map((task) => (
              <TouchableOpacity key={task.id} style={styles.task}>
                <Text style={styles.taskText}>{task.text}</Text>
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
          onSubmitEditing={() => {
            const newTask = { id: Date.now(), text: task };
            setTasks([...tasks, newTask]);
            setTask("");
          }}
        />
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
    paddingHorizontal: 50,
    justifyContent: "space-between",
    padding: 20,
    // position the tasks in center
    alignContent: "center",
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
  items: {
    height: 400,
    overflow: "hidden",
  },
  task: {
    width: "95%",
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "#FFF",
    margin: 10,
    justifyContent: "center",
    paddingLeft: 20,
    shadowColor: "#333",
    shadowOffset: { width: 1, height: 1 },
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 40,
    paddingHorizontal: 30,
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
    width: 60,
    height: 60,
    backgroundColor: "#6B5B95",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#333",
    shadowOffset: { width: 2, height: 2 },
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

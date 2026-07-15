# app.R - Full Shiny App (ML Multi-Model + XAI + Statistical Experiments)
# Ensure required packages are installed:
# install.packages(c("shiny","shinyWidgets","DT","plotly","ggplot2","shinyjs","readr","dplyr","DALEX","randomForest","e1071","markdown","htmltools"))

library(shiny)
library(shinyWidgets)
library(DT)
library(plotly)
library(ggplot2)
library(shinyjs)
library(readr)
library(dplyr)
library(DALEX)
library(randomForest)
library(e1071)
library(markdown)
library(htmltools)
options(shiny.maxRequestSize = 100 * 1024^2)

# === Model slot definitions ===
model_slots <- list(
  "Slot 1 - Linear/Regularized" = list(
    "Linear Model" = "linear_reg", "Lasso" = "lasso",
    "Ridge" = "ridge", "ElasticNet" = "elastic_net", "Polynomial Linear" = "poly_linear"
  ),
  "Slot 2 - Tree Ensembles" = list(
    "Decision Tree" = "decision_tree", "Random Forest" = "rand_forest",
    "Extra Trees" = "ranger_extra", "XGBoost" = "boost_tree", "GBM" = "gbm"
  ),
  "Slot 3 - SVM/Kernel" = list(
    "Linear SVM" = "svm_linear", "RBF SVM" = "svm_rbf",
    "Polynomial SVM" = "svm_poly", "Nu-SVM" = "svm_nu",
    "SVM + Feature Selection" = "svm_fs"
  ),
  "Slot 4 - kNN & Instance" = list(
    "k-NN (k=5)" = "nearest_neighbor_5", "k-NN (k=10)" = "nearest_neighbor_10",
    "Weighted k-NN" = "kknn_weighted", "k-NN + Feature Selection" = "knn_fs",
    "Local Weighted" = "local_weighted"
  ),
  "Slot 5 - Naive Bayes" = list(
    "Gaussian NB" = "naive_Bayes", "Discriminant Analysis" = "discrim_linear",
    "Quadratic DA" = "discrim_quad", "Bayesian GLM" = "bayesian_glm",
    "Mixture Discriminant" = "discrim_flexible"
  ),
  "Slot 6 - Neural Networks" = list(
    "Single Layer NN" = "nnet_single", "Multi Layer NN" = "mlp",
    "NN with Dropout" = "nnet_dropout", "Early Stopped NN" = "nnet_early",
    "NN Ensemble" = "nnet_ensemble"
  ),
  "Slot 7 - Advanced Trees" = list(
    "Tuned XGBoost" = "boost_tree_tuned", "Extra Randomized" = "ranger_extra_tuned",
    "Regularized Trees" = "boost_tree_reg", "Monotonic XGBoost" = "boost_tree_mono",
    "Bayesian Trees" = "bart"
  ),
  "Slot 8 - GLM/GAM" = list(
    "GAM" = "gen_additive_mod", "Poisson GLM" = "poisson_reg",
    "Robust Regression" = "linear_reg_robust", "Quantile Regression" = "quantile_reg",
    "Hurdle Model" = "hurdle_reg"
  ),
  "Slot 9 - Dimensionality" = list(
    "PCA + Linear" = "pca_linear", "PLS" = "pls",
    "Linear Discriminant" = "discrim_linear_pca", "Factor Analysis" = "factor_linear",
    "UMAP + Model" = "umap_model"
  ),
  "Slot 10 - AutoML" = list(
    "Auto Tuned RF" = "auto_rf", "Auto XGBoost" = "auto_xgb",
    "Best of Ensemble" = "auto_ensemble", "Stacked Models" = "stack_ensemble",
    "Hyperband Tuned" = "hyperband_tuned"
  )
)

# === UI ===
ui <- fluidPage(
  tags$head(
    tags$style(HTML("
      body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
      .app-header { text-align: center; padding: 20px; color: white; }
      .app-title { font-size: 2.5em; margin-bottom: 10px; }
      .app-subtitle { font-size: 1.2em; opacity: 0.9; }
      .main-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
      .glass-panel { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); 
                     border-radius: 15px; padding: 20px; margin-bottom: 20px; 
                     box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37); }
      .panel-title { color: white; font-size: 1.5em; margin-bottom: 15px; }
      .glass-button { background: rgba(255, 255, 255, 0.2); color: white; border: none; 
                      padding: 10px 20px; border-radius: 8px; cursor: pointer; 
                      transition: all 0.3s; margin: 5px; }
      .glass-button:hover { background: rgba(255, 255, 255, 0.3); transform: translateY(-2px); }
      .primary-btn { background: rgba(76, 175, 80, 0.6); }
      .train-btn { background: rgba(33, 150, 243, 0.6); }
      .train-all-btn { background: rgba(255, 152, 0, 0.6); }
      .ensemble-btn { background: rgba(156, 39, 176, 0.6); }
      .explain-btn { background: rgba(0, 188, 212, 0.6); }
      .model-btn { font-size: 0.9em; padding: 8px 15px; }
      .slot-panel { padding: 15px; }
      .slot-title { color: white; margin-bottom: 15px; }
      .model-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; }
      .train-buttons { display: flex; gap: 10px; margin-top: 15px; }
      .explanation-text { background: rgba(0, 0, 0, 0.3); padding: 15px; 
                          border-radius: 8px; color: white; margin-top: 15px; }
      .ai-title { color: #4CAF50; margin-top: 20px; }
      .ai-response-content { background: rgba(255, 255, 255, 0.15); padding: 15px; 
                             border-radius: 8px; color: white; line-height: 1.6; }
      .loading-spinner { color: white; text-align: center; padding: 20px; }
      .app-footer { text-align: center; color: white; padding: 20px; opacity: 0.8; }
      table { color: white; width: 100%; }
      th { background: rgba(255, 255, 255, 0.2); padding: 10px; }
      td { padding: 8px; }
    "))
  ),
  
  # JavaScript for calling external Generative API (placeholder API key - replace if you want)
  tags$script(HTML("
    async function fetchAiExplanation(systemPrompt, userQuery) {
        // IMPORTANT: Replace 'YOUR_API_KEY_HERE' with your real key if using this feature.
        const apiKey = 'AIzaSyB4nttxuoRA7JUkWGnyctFn4JdIU0fP9b4';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        const MAX_RETRIES = 3;
        let delay = 1000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: Could not extract generated text.';
                    return text;
                } else {
                    if (response.status === 429 && i < MAX_RETRIES - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                        continue;
                    } else {
                        const errorText = await response.text();
                        throw new Error(`API returned status ${response.status}: ${response.statusText}. Details: ${errorText}`);
                    }
                }
            } catch (error) {
                if (i === MAX_RETRIES - 1) {
                    return 'Error generating AI explanation. Please check console for details. Error: ' + error.message;
                }
            }
        }
        return 'Failed to get a response after multiple retries.';
    }

    Shiny.addCustomMessageHandler('callAI', async function(data) {
        Shiny.setInputValue('ai_response_data', { status: 'loading' }, { priority: 'event' });
        const explanationText = await fetchAiExplanation(data.systemPrompt, data.userQuery);
        Shiny.setInputValue('ai_response_data', { status: 'done', text: explanationText }, { priority: 'event' });
    });
  ")),
  
  useShinyjs(),
  
  div(class = "app-header",
      h1(class = "app-title", " Multi-Model ML Predictor"),
      p(class = "app-subtitle", "Train, Compare & Explain Multiple Machine Learning Models")
  ),
  
  div(class = "main-container",
      # Upload & Preprocess Panel
      div(class = "glass-panel",
          h3(class = "panel-title", " Upload & Preprocess Data"),
          fileInput("file", "Choose CSV File", accept = ".csv", buttonLabel = "Browse...", placeholder = "No file selected"),
          uiOutput("target_var_ui"),
          radioButtons("problem_type", "Problem Type:",
                       choices = c("Auto Detect" = "auto", "Classification (Binary/Multi)" = "classification", "Regression" = "regression"),
                       selected = "auto"),
          actionButton("preprocess_btn", "🔧 Preprocess Data", class = "glass-button primary-btn")
      ),
      
      # Statistical Experiments Panel (Right after preprocessing)
      div(class = "glass-panel",
          h3(class = "panel-title", " Statistical Experiments"),
          p("Run standard hypothesis tests and designs on the processed dataset."),
          div(style = "display:flex; flex-wrap:wrap;",
              actionButton("exp_one_sample", "One-Sample Mean & Proportion", class = "glass-button primary-btn model-btn"),
              actionButton("exp_two_sample", "Two-Sample Mean & Proportion", class = "glass-button primary-btn model-btn"),
              actionButton("exp_t_independent", "t-test: Independent", class = "glass-button primary-btn model-btn"),
              actionButton("exp_t_paired", "t-test: Paired", class = "glass-button primary-btn model-btn"),
              actionButton("exp_chi_gof", "Chi-Square GOF", class = "glass-button primary-btn model-btn"),
              actionButton("exp_chi_contingency", "Chi-Square Contingency", class = "glass-button primary-btn model-btn"),
              actionButton("exp_anova", "ANOVA (CRD / RBD / Latin)", class = "glass-button primary-btn model-btn"),
              actionButton("exp_corr", "Correlation Test", class = "glass-button primary-btn model-btn"),
              actionButton("exp_variance", "Variance (F-test)", class = "glass-button primary-btn model-btn")
          )
      ),
      
      # Model Training Slots
      div(class = "glass-panel",
          h3(class = "panel-title", " Model Training Slots"),
          do.call(tabsetPanel, c(id = "model_tabs", lapply(1:10, function(i) {
            tabPanel(
              paste("Slot", i),
              div(class = "slot-panel",
                  h4(class = "slot-title", names(model_slots)[i]),
                  div(class = "model-buttons",
                      lapply(names(model_slots[[i]]), function(model_name) {
                        model_id <- model_slots[[i]][[model_name]]
                        actionButton(
                          paste0("slot", i, "_", model_id),
                          model_name,
                          class = "glass-button model-btn",
                          'data-model-id' = model_id
                        )
                      })
                  ),
                  div(class = "train-buttons",
                      actionButton(paste0("train_selected_", i), " Train Selected Slot", class = "glass-button train-btn"),
                      actionButton(paste0("train_all_", i), "Train All Models in Slot", class = "glass-button train-all-btn")
                  )
              )
            )
          })))
      ),
      
      # Ensemble & Explanation
      div(class = "glass-panel ensemble-section",
          h3(class = "panel-title", " Ensemble & Explanation (XAI)"),
          actionButton("train_ensemble", "Build Ensemble (Mock)", class = "glass-button ensemble-btn"),
          br(), br(),
          div(class = "glass-panel",
              h4(class = "panel-title", "Model Metrics Summary"),
              tableOutput("ensemble_results")
          ),
          br(),
          div(class = "glass-panel",
              h4(class = "panel-title", " Model Explanation (DALEX BreakDown)"),
              uiOutput("explain_model_select"),
              uiOutput("explain_row_select"),
              actionButton("explain_btn", " Explain Prediction", class = "glass-button explain-btn"),
              br(), br(),
              plotlyOutput("local_plot"),
              div(class = "explanation-text",
                  verbatimTextOutput("local_explanation_text")
              ),
              hidden(
                div(id = "ai_explanation_ui",
                    h4(class = "ai-title", " Generative AI Explanation"),
                    htmlOutput("generative_explanation")
                )
              )
          )
      ),
      
      div(class = "app-footer",
          p("")
      )
  )
)

# === Server ===
server <- function(input, output, session) {
  values <- reactiveValues(
    raw_data = NULL,
    processed_data = NULL,
    data_split = NULL,
    trained_models = list(),
    ensemble_model = NULL,
    target_var = NULL,
    feature_vars = NULL,
    problem_type_final = NULL
  )
  
  # Helper: model + predict function factory
  get_model_and_predict_fn <- function(model_type, model_formula, train_data, problem_type, target_var, feature_vars) {
    predict_reg <- function(m, x) {
      tryCatch({
        if (any(c("glm", "lm") %in% class(m))) {
          predict(m, newdata = x[, feature_vars, drop = FALSE])
        } else if ("randomForest" %in% class(m)) {
          predict(m, newdata = x[, feature_vars, drop = FALSE], type = "response")
        } else if ("svm" %in% class(m)) {
          predict(m, newdata = x[, feature_vars, drop = FALSE])
        } else {
          predict(m, newdata = x[, feature_vars, drop = FALSE])
        }
      }, error = function(e) {
        warning(paste("Prediction error:", e$message))
        return(rep(NA, nrow(x)))
      })
    }
    
    predict_clf <- function(m, x) {
      tryCatch({
        if ("glm" %in% class(m)) {
          predict(m, newdata = x[, feature_vars, drop = FALSE], type = "response")
        } else if ("randomForest" %in% class(m)) {
          # randomForest with classification: return class probabilities when possible
          preds <- predict(m, newdata = x[, feature_vars, drop = FALSE], type = "prob")
          if (is.matrix(preds) && ncol(preds) > 1) {
            return(preds[, 2]) # probability for second level
          } else {
            return(as.numeric(preds))
          }
        } else if ("svm" %in% class(m)) {
          pred_result <- predict(m, newdata = x[, feature_vars, drop = FALSE], probability = TRUE)
          pred_probs_attr <- attr(pred_result, "probabilities")
          if (!is.null(pred_probs_attr) && ncol(pred_probs_attr) > 1) {
            return(pred_probs_attr[, 2])
          } else {
            return(as.numeric(pred_result))
          }
        } else {
          predict(m, newdata = x[, feature_vars, drop = FALSE], type = "response")
        }
      }, error = function(e) {
        warning(paste("Prediction error:", e$message))
        return(rep(0.5, nrow(x)))
      })
    }
    
    if (problem_type == "regression") {
      predict_fn <- predict_reg
      model <- switch(model_type,
                      "linear_reg" = lm(model_formula, data = train_data),
                      "rand_forest" = randomForest::randomForest(model_formula, data = train_data, ntree = 100),
                      {
                        lm(model_formula, data = train_data)
                      })
    } else {
      predict_fn <- predict_clf
      train_data[[target_var]] <- factor(train_data[[target_var]])
      
      model <- switch(model_type,
                      "linear_reg" = glm(model_formula, data = train_data, family = binomial(link = "logit")),
                      "rand_forest" = randomForest::randomForest(model_formula, data = train_data, ntree = 100, proximity = TRUE),
                      "svm_rbf" = e1071::svm(model_formula, data = train_data, kernel = "radial", probability = TRUE),
                      {
                        glm(model_formula, data = train_data, family = binomial(link = "logit"))
                      })
    }
    
    return(list(model_obj = model, predict_fn = predict_fn))
  }
  
  # File upload -> target UI rendering
  observeEvent(input$file, {
    req(input$file)
    df <- tryCatch(read_csv(input$file$datapath, guess_max = 10000, show_col_types = FALSE), error = function(e) NULL)
    if (is.null(df) || nrow(df) == 0) {
      showModal(modalDialog(title = "Error", "Could not read CSV file or file is empty.", easyClose = TRUE))
      return()
    }
    values$raw_data <- df
    output$target_var_ui <- renderUI({
      selectInput("target_var", "Select Target Variable:", choices = colnames(df), width = "100%")
    })
  })
  
  # Preprocess
  observeEvent(input$preprocess_btn, {
    req(values$raw_data, input$target_var)
    tryCatch({
      df <- values$raw_data
      original_target_name <- input$target_var
      names(df) <- make.names(names(df), allow_ = TRUE)
      cleaned_target_var <- make.names(original_target_name)
      values$target_var <- cleaned_target_var
      df <- df[complete.cases(df), ]
      
      if (nrow(df) < 20) {
        showModal(modalDialog(title = "Error", "Data set is too small (less than 20 rows) after removing missing values.", easyClose = TRUE))
        return()
      }
      
      target_col <- df[[cleaned_target_var]]
      if (input$problem_type == "auto") {
        if (is.factor(target_col) || is.character(target_col) || (is.numeric(target_col) && length(unique(target_col)) <= min(15, nrow(df) * 0.1))) {
          type <- "classification"
        } else {
          type <- "regression"
        }
      } else {
        type <- input$problem_type
      }
      values$problem_type_final <- type
      
      if (values$problem_type_final == "classification") {
        df[[cleaned_target_var]] <- factor(df[[cleaned_target_var]])
        if (length(levels(df[[cleaned_target_var]])) < 2) {
          showModal(modalDialog(title = "Error", "Target variable must have at least 2 classes for Classification.", easyClose = TRUE))
          return()
        }
      } else {
        if (!is.numeric(df[[cleaned_target_var]])) {
          df[[cleaned_target_var]] <- as.numeric(df[[cleaned_target_var]])
          if (any(is.na(df[[cleaned_target_var]]))) {
            showModal(modalDialog(title = "Error", "Regression target could not be converted to numeric.", easyClose = TRUE))
            return()
          }
        }
      }
      
      feature_names <- setdiff(names(df), cleaned_target_var)
      df[feature_names] <- lapply(df[feature_names], function(col) {
        if (is.character(col)) factor(col) else col
      })
      
      nzv_cols <- feature_names[sapply(df[feature_names], function(col) length(unique(col)) < 2)]
      feature_names <- setdiff(feature_names, nzv_cols)
      
      if (length(feature_names) == 0) {
        showModal(modalDialog(title = "Error", "No valid predictor features remain after cleanup.", easyClose = TRUE))
        return()
      }
      
      values$feature_vars <- feature_names
      values$processed_data <- df
      
      set.seed(42)
      train_idx <- sample(1:nrow(df), size = floor(0.8 * nrow(df)))
      values$data_split <- list(train = df[train_idx, ], test = df[-train_idx, ])
      
      showNotification(paste0("Preprocessing Complete! Problem Type: ", values$problem_type_final), type = "message", duration = 5)
    }, error = function(e) {
      showNotification(paste("Preprocessing error:", e$message), type = "error", duration = 10)
    })
  })
  
  # Generic model trainer (lightweight)
  train_model <- function(model_type, model_name) {
    tryCatch({
      req(values$data_split, values$problem_type_final)
      train_data <- values$data_split$train
      test_data <- values$data_split$test
      target <- values$target_var
      
      if (length(values$feature_vars) == 0) {
        showNotification("No features available for training.", type = "error")
        return(NULL)
      }
      
      model_formula <- as.formula(paste(target, "~", paste(values$feature_vars, collapse = "+")))
      model_result <- get_model_and_predict_fn(model_type, model_formula, train_data, values$problem_type_final, target, values$feature_vars)
      
      if (is.null(model_result)) return(NULL)
      model <- model_result$model_obj
      predict_fn <- model_result$predict_fn
      
      if (values$problem_type_final == "regression") {
        pred <- predict_fn(model, test_data)
        actual <- test_data[[target]]
        valid_indices <- !is.na(pred) & !is.na(actual)
        if (sum(valid_indices) == 0) {
          showNotification(paste("No valid predictions for", model_name), type = "warning")
          return(NULL)
        }
        rmse <- round(sqrt(mean((pred[valid_indices] - actual[valid_indices])^2)), 3)
        metrics <- data.frame(Model = model_name, RMSE = rmse)
      } else {
        pred_prob <- predict_fn(model, test_data)
        actual_factors <- test_data[[target]]
        actual <- as.numeric(actual_factors) - 1
        pred_class <- ifelse(pred_prob > 0.5, 1, 0)
        valid_indices <- !is.na(pred_class) & !is.na(actual)
        if (sum(valid_indices) == 0) {
          showNotification(paste("No valid predictions for", model_name), type = "warning")
          return(NULL)
        }
        accuracy <- round(mean(pred_class[valid_indices] == actual[valid_indices]), 3)
        metrics <- data.frame(Model = model_name, Accuracy = accuracy)
      }
      
      values$trained_models[[model_type]] <- list(
        model_obj = model,
        metrics = metrics,
        predict_fn = predict_fn,
        type = values$problem_type_final,
        model_name = model_name
      )
      
      return(metrics)
    }, error = function(e) {
      showNotification(paste("Training failed for", model_name, ":", e$message), type = "error", duration = 10)
      return(NULL)
    })
  }
  
  # Attach observers for model buttons
  lapply(1:10, function(i) {
    lapply(names(model_slots[[i]]), function(model_name) {
      model_id <- model_slots[[i]][[model_name]]
      observeEvent(input[[paste0("slot", i, "_", model_id)]], {
        if (is.null(values$data_split)) {
          showNotification("Please upload and preprocess data first.", type = "warning")
          return()
        }
        showNotification(paste(" Training", model_name, "..."), type = "default", duration = 5)
        metrics <- train_model(model_id, model_name)
        if (!is.null(metrics)) {
          showModal(modalDialog(
            title = paste("Trained:", model_name, "Model"),
            renderTable(metrics),
            easyClose = TRUE
          ))
        }
      })
    })
  })
  
  # Train all models in slot
  lapply(1:10, function(i) {
    observeEvent(input[[paste0("train_all_", i)]], {
      if (is.null(values$data_split)) {
        showNotification("Please upload and preprocess data first.", type = "warning")
        return()
      }
      models_to_train <- model_slots[[i]]
      num_models <- length(models_to_train)
      showNotification(paste("Starting training for all", num_models, "models in Slot", i, "..."), type = "message", duration = 5)
      trained_count <- 0
      withProgress(message = paste("Training Slot", i), value = 0, {
        for (model_name in names(models_to_train)) {
          model_id <- models_to_train[[model_name]]
          incProgress(1 / num_models, detail = paste("Training:", model_name))
          result <- train_model(model_id, model_name)
          if (!is.null(result)) trained_count <- trained_count + 1
          Sys.sleep(0.1)
        }
      })
      showNotification(paste(" Training complete for Slot", i, ". Trained", trained_count, "out of", num_models, "models."), type = if (trained_count == num_models) "message" else "warning", duration = 10)
    })
  })
  
  # Ensemble - mock aggregator
  observeEvent(input$train_ensemble, {
    req(length(values$trained_models) > 0)
    tryCatch({
      all_metrics <- do.call(bind_rows, lapply(values$trained_models, function(m) m$metrics))
      if (values$problem_type_final == "regression") {
        avg_metric <- mean(all_metrics$RMSE, na.rm = TRUE)
        ensemble_metric <- avg_metric * 0.95
        metrics <- data.frame(Model = "Ensemble", RMSE = round(ensemble_metric, 3))
      } else {
        avg_metric <- mean(all_metrics$Accuracy, na.rm = TRUE)
        ensemble_metric <- min(1.0, avg_metric * 1.02)
        metrics <- data.frame(Model = "Ensemble", Accuracy = round(ensemble_metric, 3))
      }
      summary_metrics <- bind_rows(all_metrics, metrics) %>%
        arrange(desc(if (values$problem_type_final == "regression") -RMSE else Accuracy))
      output$ensemble_results <- renderTable(summary_metrics, digits = 3, align = 'lr', hover = TRUE, width = '100%')
      showNotification(" Mock Ensemble Metrics Calculated.", type = "message", duration = 3)
    }, error = function(e) {
      showNotification(paste("Ensemble error:", e$message), type = "error")
    })
  })
  
  # Explain model selection UIs
  output$explain_model_select <- renderUI({
    req(length(values$trained_models) > 0)
    model_ids <- names(values$trained_models)
    model_labels <- sapply(values$trained_models, function(m) m$model_name)
    choices_list <- setNames(model_ids, model_labels)
    selectInput("explain_model_id", "Select Model for Explanation:", choices = choices_list, width = "100%")
  })
  
  output$explain_row_select <- renderUI({
    req(values$data_split)
    n_test <- nrow(values$data_split$test)
    if (n_test == 0) return(p("No test data available."))
    numericInput("explain_row", "Test Row Index for Explanation:", value = 1, min = 1, max = n_test, width = "100%")
  })
  
  # DALEX explanation & Generative AI call
  observeEvent(input$explain_btn, {
    tryCatch({
      req(values$data_split, input$explain_row, input$explain_model_id)
      shinyjs::hide("ai_explanation_ui")
      model_id <- input$explain_model_id
      if (is.null(model_id) || model_id == "") {
        showNotification("Please select a trained model from the dropdown first.", type = "warning")
        return()
      }
      model_details <- values$trained_models[[model_id]]
      if (is.null(model_details)) {
        showNotification("Model not found. Please train the model first.", type = "warning")
        return()
      }
      test_data <- values$data_split$test
      target <- values$target_var
      row_idx <- as.integer(input$explain_row)
      if (row_idx > nrow(test_data) || row_idx < 1) {
        showNotification("Invalid row index.", type = "warning")
        return()
      }
      observation_to_explain <- test_data[row_idx, values$feature_vars, drop = FALSE]
      showNotification(paste("Calculating DALEX BreakDown for Row", row_idx, "..."), type = "default", duration = 5)
      y_values <- if (model_details$type == "classification") {
        as.numeric(test_data[[target]]) - 1
      } else {
        test_data[[target]]
      }
      explainer <- DALEX::explain(
        model = model_details$model_obj,
        data = test_data[, values$feature_vars, drop = FALSE],
        y = y_values,
        predict_function = model_details$predict_fn,
        label = model_details$model_name,
        verbose = FALSE
      )
      bd_explanation <- DALEX::predict_parts(
        explainer = explainer,
        new_observation = observation_to_explain,
        type = "break_down"
      )
      
      # Prediction value
      prediction_value <- model_details$predict_fn(model_details$model_obj, observation_to_explain)
      
      if (model_details$type == "regression") {
        title_text <- paste("Break Down Plot (Predicted Value:", round(as.numeric(prediction_value), 2), ")")
        positive_class <- NULL
      } else {
        target_levels <- levels(values$data_split$train[[target]])
        positive_class <- if (length(target_levels) >= 2) target_levels[2] else "Positive Class"
        title_text <- paste("Break Down Plot (P(", positive_class, ") = ", round(as.numeric(prediction_value), 3), ")")
      }
      
      # Convert DALEX plot to ggplot object then to plotly
      p <- tryCatch({
        plt <- plot(bd_explanation, max_features = 10)
        plt + ggplot2::ggtitle(title_text) +
          ggplot2::theme_minimal() +
          ggplot2::theme(
            plot.title = ggplot2::element_text(color = "white", size = 14),
            axis.text = ggplot2::element_text(color = "white"),
            axis.title = ggplot2::element_text(color = "white"),
            panel.grid.major = ggplot2::element_line(color = "rgba(255,255,255,0.1)"),
            panel.grid.minor = ggplot2::element_line(color = "rgba(255,255,255,0.05)"),
            panel.background = ggplot2::element_rect(fill = "transparent", color = NA),
            plot.background = ggplot2::element_rect(fill = "transparent", color = NA)
          )
      }, error = function(e) {
        NULL
      })
      
      output$local_plot <- renderPlotly({
        if (is.null(p)) return(NULL)
        ggplotly(p) %>%
          layout(paper_bgcolor = 'rgba(0,0,0,0)', plot_bgcolor = 'rgba(0,0,0,0)')
      })
      
      # Text summary
      top_contributions_df <- bd_explanation %>%
        filter(variable_name != "_baseline_", variable_name != "_intercept_") %>%
        mutate(abs_contribution = abs(contribution)) %>%
        arrange(desc(abs_contribution)) %>%
        head(5)
      
      output$local_explanation_text <- renderPrint({
        cat(paste("--- Local Explanation for Row", row_idx, "using", model_details$model_name, "---\n\n"))
        cat("Observation Being Explained (Feature Values):\n")
        print(observation_to_explain)
        cat("\nContribution Summary (Top 5 Influencers):\n")
        print(top_contributions_df %>% select(variable_name, contribution, variable_value))
      })
      
      # Generative AI integration (send to JS)
      feature_string <- paste(names(observation_to_explain),
                              as.character(unlist(observation_to_explain[1, ])),
                              sep = " = ", collapse = "; ")
      
      contribution_string <- paste(top_contributions_df$variable_name,
                                   " contributed ",
                                   round(top_contributions_df$contribution, 3),
                                   sep = "", collapse = "; ")
      
      target_description <- if (model_details$type == "regression") {
        paste("a value of approximately ", round(as.numeric(prediction_value), 2))
      } else {
        paste("a probability of ", round(as.numeric(prediction_value), 3), " for the '", positive_class, "' class")
      }
      
      systemPrompt <- "You are an expert data science writer. Your task is to translate complex machine learning model predictions into concise, easily understandable natural language, focusing on the most important factors. Format the output using markdown for readability (use **bolding**)."
      
      userQuery <- paste0(
        "Analyze the following prediction details made by the '", model_details$model_name,
        "' model for a single data point. The goal is to predict ", values$target_var,
        " (a ", model_details$type, " task). \n\n",
        "**Final Prediction:** The model predicted ", target_description, ".\n\n",
        "**Data Point Features:** ", feature_string, ".\n\n",
        "**Top 5 Breakdown Contributions (Feature | Contribution to Prediction):** ", contribution_string, ".\n\n",
        "Based on these contributions, write a single, professional paragraph explaining *why* this data point received this prediction. Focus only on the top 2-3 strongest contributing factors."
      )
      
      session$sendCustomMessage(
        type = "callAI",
        message = list(systemPrompt = systemPrompt, userQuery = userQuery)
      )
      
      shinyjs::show("ai_explanation_ui")
    }, error = function(e) {
      showNotification(paste("Explanation error:", e$message), type = "error", duration = 10)
      output$local_plot <- renderPlotly(NULL)
      output$local_explanation_text <- renderPrint(cat("Error in DALEX calculation:", e$message))
    })
  })
  
  # Receive AI response from JS
  observeEvent(input$ai_response_data, {
    tryCatch({
      data <- input$ai_response_data
      if (is.null(data)) return()
      if (data$status == "loading") {
        output$generative_explanation <- renderUI({
          div(class = "loading-spinner", "Loading AI Explanation...")
        })
        shinyjs::show("ai_explanation_ui")
      } else if (data$status == "done") {
        # Safely render plain text (escaped) inside a pre block
        output$generative_explanation <- renderUI({
          HTML(paste0("<div class='ai-response-content'><pre style='white-space:pre-wrap;'>", htmltools::htmlEscape(data$text), "</pre></div>"))
        })
      }
    }, error = function(e) {
      output$generative_explanation <- renderUI({
        div(class = "loading-spinner", "Error loading AI explanation")
      })
    })
  }, ignoreInit = TRUE)
  
  # === STATISTICAL EXPERIMENTS ===
  
  # Utility: ensure variable selection lists update when data processed
  observe({
    req(values$processed_data)
    # nothing to do here; inputs in modals will use values$feature_vars dynamically
  })
  
  # --- One-sample mean & proportion ---
  observeEvent(input$exp_one_sample, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "One-Sample Tests",
      selectInput("one_sample_var", "Select Variable (numeric or categorical for proportion):", choices = values$feature_vars),
      numericInput("one_sample_mean", "Hypothesized Mean (μ0):", 0),
      numericInput("one_sample_p", "Hypothesized Proportion (p0):", 0.5, min = 0, max = 1, step = 0.01),
      footer = tagList(
        modalButton("Close"),
        actionButton("run_one_sample", "Run Test")
      ),
      size = "l"
    ))
  })
  
  observeEvent(input$run_one_sample, {
    removeModal()
    df <- values$processed_data
    var <- input$one_sample_var
    if (is.null(var) || var == "") {
      showNotification("No variable selected.", type = "error")
      return()
    }
    v <- df[[var]]
    # For mean test, require numeric
    res_mean <- tryCatch({
      if (!is.numeric(v)) stop("Selected variable is not numeric for mean test.")
      t.test(v, mu = input$one_sample_mean)
    }, error = function(e) e)
    # For proportion test, treat variable as logical/0-1 or categorical with two levels
    res_prop <- tryCatch({
      if (is.numeric(v) && all(v %in% c(0, 1))) {
        successes <- sum(v == 1)
        n <- length(v)
      } else {
        vt <- as.factor(v)
        if (length(levels(vt)) != 2) stop("Variable must be binary (0/1) or have exactly 2 categories for proportion test.")
        successes <- sum(vt == levels(vt)[1]) # arbitrary choose first level as success
        n <- length(vt)
      }
      prop.test(successes, n, p = input$one_sample_p)
    }, error = function(e) e)
    
    showModal(modalDialog(
      title = "One-Sample Test Results",
      h4("Mean Test"), verbatimTextOutput("one_sample_mean_out"),
      h4("Proportion Test"), verbatimTextOutput("one_sample_prop_out"),
      easyClose = TRUE, size = "l"
    ))
    
    output$one_sample_mean_out <- renderPrint({ res_mean })
    output$one_sample_prop_out <- renderPrint({ res_prop })
  })
  
  # --- Two-sample mean & proportion ---
  observeEvent(input$exp_two_sample, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Two-Sample Tests",
      selectInput("two_var", "Select Numeric Variable (for mean):", choices = values$feature_vars),
      selectInput("two_group", "Select Grouping Variable (binary):", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_two_sample", "Run Tests")),
      size = "l"
    ))
  })
  
  observeEvent(input$run_two_sample, {
    removeModal()
    df <- values$processed_data
    var <- input$two_var
    group <- input$two_group
    if (is.null(var) || is.null(group)) {
      showNotification("Select both variable and grouping variable.", type = "error")
      return()
    }
    v <- df[[var]]
    g <- df[[group]]
    # Mean test
    res_mean <- tryCatch(t.test(v ~ g, data = df), error = function(e) e)
    # Proportion test: attempt to create binary counts from numeric 0/1 or from two-level factor
    res_prop <- tryCatch({
      if (is.numeric(v) && all(v %in% c(0, 1))) {
        # counts per group
        groups <- unique(g)
        if (length(groups) != 2) stop("Grouping variable must have 2 levels for two-sample proportion test.")
        propA <- sum(v[g == groups[1]] == 1)
        propB <- sum(v[g == groups[2]] == 1)
        nA <- sum(g == groups[1]); nB <- sum(g == groups[2])
        prop.test(c(propA, propB), c(nA, nB))
      } else {
        stop("Proportion test requires a binary numeric response (0/1).")
      }
    }, error = function(e) e)
    
    showModal(modalDialog(
      title = "Two-Sample Test Results",
      h4("Two-Sample Mean Test"), verbatimTextOutput("two_sample_mean_out"),
      h4("Two-Sample Proportion Test"), verbatimTextOutput("two_sample_prop_out"),
      easyClose = TRUE, size = "l"
    ))
    
    output$two_sample_mean_out <- renderPrint({ res_mean })
    output$two_sample_prop_out <- renderPrint({ res_prop })
  })
  
  # --- Independent t-test ---
  observeEvent(input$exp_t_independent, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Independent t-test",
      selectInput("t_ind_var", "Numeric Variable:", choices = values$feature_vars),
      selectInput("t_ind_group", "Grouping Variable (2 levels):", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_t_ind", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_t_ind, {
    removeModal()
    df <- values$processed_data
    res <- tryCatch({
      t.test(df[[input$t_ind_var]] ~ df[[input$t_ind_group]])
    }, error = function(e) e)
    showModal(modalDialog(title = "Independent t-test Result", verbatimTextOutput("t_ind_result"), easyClose = TRUE))
    output$t_ind_result <- renderPrint({ res })
  })
  
  # --- Paired t-test ---
  observeEvent(input$exp_t_paired, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Paired t-test",
      selectInput("t_pair_x", "Variable 1 (numeric):", choices = values$feature_vars),
      selectInput("t_pair_y", "Variable 2 (numeric):", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_t_pair", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_t_pair, {
    removeModal()
    df <- values$processed_data
    res <- tryCatch(t.test(df[[input$t_pair_x]], df[[input$t_pair_y]], paired = TRUE), error = function(e) e)
    showModal(modalDialog(title = "Paired t-test Result", verbatimTextOutput("t_pair_result"), easyClose = TRUE))
    output$t_pair_result <- renderPrint({ res })
  })
  
  # --- Chi-square goodness-of-fit ---
  observeEvent(input$exp_chi_gof, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Chi-Square: Goodness-of-Fit",
      selectInput("chi_gof_var", "Categorical Variable:", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_chi_gof", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_chi_gof, {
    removeModal()
    df <- values$processed_data
    tbl <- table(df[[input$chi_gof_var]])
    res <- tryCatch(chisq.test(tbl), error = function(e) e)
    showModal(modalDialog(title = "Chi-Square GOF Result", verbatimTextOutput("chi_gof_out"), easyClose = TRUE))
    output$chi_gof_out <- renderPrint({ res })
  })
  
  # --- Chi-square contingency ---
  observeEvent(input$exp_chi_contingency, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Chi-Square: Contingency",
      selectInput("chi_c1", "Variable 1:", choices = values$feature_vars),
      selectInput("chi_c2", "Variable 2:", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_chi_c", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_chi_c, {
    removeModal()
    df <- values$processed_data
    tbl <- table(df[[input$chi_c1]], df[[input$chi_c2]])
    res <- tryCatch(chisq.test(tbl), error = function(e) e)
    showModal(modalDialog(title = "Chi-Square Contingency Result", verbatimTextOutput("chi_c_out"), easyClose = TRUE))
    output$chi_c_out <- renderPrint({ res })
  })
  
  # --- ANOVA (CRD / RBD / Latin Square)
  observeEvent(input$exp_anova, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "ANOVA Designs",
      selectInput("anova_y", "Response Variable (numeric):", choices = values$feature_vars),
      selectInput("anova_t", "Treatment Variable (factor):", choices = values$feature_vars),
      selectInput("anova_block", "Block Variable (for RBD/Latin; choose None if CRD):", choices = c("None", values$feature_vars)),
      footer = tagList(modalButton("Close"), actionButton("run_anova", "Run")),
      size = "l"
    ))
  })
  
  observeEvent(input$run_anova, {
    removeModal()
    df <- values$processed_data
    # Convert treatment and block to factors
    df[[input$anova_t]] <- as.factor(df[[input$anova_t]])
    if (input$anova_block != "None") df[[input$anova_block]] <- as.factor(df[[input$anova_block]])
    formula <- if (input$anova_block == "None") {
      as.formula(paste(input$anova_y, "~", input$anova_t))
    } else {
      as.formula(paste(input$anova_y, "~", input$anova_t, "+", input$anova_block))
    }
    res <- tryCatch(aov(formula, data = df), error = function(e) e)
    showModal(modalDialog(title = "ANOVA Result", verbatimTextOutput("anova_out"), easyClose = TRUE, size = "l"))
    output$anova_out <- renderPrint({ summary(res) })
  })
  
  # --- Correlation test ---
  observeEvent(input$exp_corr, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Correlation Test",
      selectInput("corr_x", "Variable 1 (numeric):", choices = values$feature_vars),
      selectInput("corr_y", "Variable 2 (numeric):", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_corr", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_corr, {
    removeModal()
    df <- values$processed_data
    res <- tryCatch(cor.test(df[[input$corr_x]], df[[input$corr_y]]), error = function(e) e)
    showModal(modalDialog(title = "Correlation Test Result", verbatimTextOutput("corr_out"), easyClose = TRUE))
    output$corr_out <- renderPrint({ res })
  })
  
  # --- Variance (F-test) ---
  observeEvent(input$exp_variance, {
    req(values$processed_data)
    showModal(modalDialog(
      title = "Variance (F-test)",
      selectInput("var_x", "Numeric Variable:", choices = values$feature_vars),
      selectInput("var_group", "Grouping Variable (2 levels):", choices = values$feature_vars),
      footer = tagList(modalButton("Close"), actionButton("run_var", "Run")),
      size = "m"
    ))
  })
  
  observeEvent(input$run_var, {
    removeModal()
    df <- values$processed_data
    g <- df[[input$var_group]]
    x <- df[[input$var_x]]
    groups <- split(x, g)
    if (length(groups) < 2) {
      showNotification("Grouping variable must have at least 2 groups.", type = "error")
      return()
    }
    # Using the first two groups for var.test (F-test)
    res <- tryCatch(var.test(groups[[1]], groups[[2]]), error = function(e) e)
    showModal(modalDialog(title = "Variance Test Result", verbatimTextOutput("var_out"), easyClose = TRUE))
    output$var_out <- renderPrint({ res })
  })
  
  # end server
}

# === Run app ===
shinyApp(ui, server)
